import { useEffect, useRef, useState } from 'react'
import { emit, openOverlay, useOverlay, useStored } from '../../lib/contracts'
import { useClock } from '../clock/useClock'
import { useDaylight } from '../clock/useDaylight'
import { useBattery } from '../device/useBattery'
import { useLocation } from '../map/useLocation'
import { SEED_QUESTS, QUESTS_KEY, type Quest } from '../quests/state'
import { useNowPlaying } from '../radio/nowPlaying'
import { useCaps } from '../terminal/useCaps'
import { useWeather } from '../weather/useWeather'
import { EMOTES, emoteForKey, requestEmote } from './emotes'
import { Flyout } from './Flyout'
import { EffectGlyph, EmoteGlyph, EmoteMenuGlyph, ReadoutGlyph } from './glyphs'
import { NAV_KEY, NAV_TARGET, navTo, readouts, type Nav, type Readout } from './statusReadouts'
import { questsDoneToday, statusEffects } from './statusEffects'
import type { Gesture } from './vaultboy/behavior'

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * EMOTES fly-out: a round trigger in the stage's bottom-right corner that fans the six
 * gestures up out of it. Number keys 1-6 still fire them directly while STATUS is open
 * (not while typing, not under an overlay); the trigger blinks to show it.
 */
export function EmoteFlyout({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const overlay = useOverlay()
  const [lit, setLit] = useState<Gesture | null>(null)
  const timer = useRef(0)

  const fire = (g: Gesture) => {
    requestEmote(g)
    emit({ type: 'list-select' })
    setLit(g)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLit(null), 450)
  }
  const fireRef = useRef(fire)
  useEffect(() => {
    fireRef.current = fire
  })
  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const g = emoteForKey(e.key)
      if (!g) return
      e.preventDefault()
      fireRef.current(g)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay])

  return (
    <Flyout
      id="emotes"
      side="right"
      className={lit ? 'is-lit' : ''}
      open={open}
      onOpenChange={onOpenChange}
      triggerLabel="Emotes (keys 1 to 6)"
      triggerTitle="Emotes  [1-6]"
      trigger={lit ? <EmoteGlyph id={lit} /> : <EmoteMenuGlyph />}
      caption="EMOTE"
      menuLabel="Emotes"
      items={EMOTES.map((e) => ({
        key: e.id,
        icon: <EmoteGlyph id={e.id} />,
        label: e.label,
        meta: e.key,
        ariaLabel: `${e.label} (key ${e.key})`,
        title: `${e.label}  [${e.key}]`,
        onSelect: () => fire(e.id),
      }))}
    />
  )
}

/** Weather for wherever the dweller is (no GPS prompt from here; MAP/STATS ask for that). */
function useLocalWeather() {
  const { coords } = useLocation()
  return useWeather(coords.lat, coords.lon)
}

/** The four readout tiles in the loadout row (icon over value). Each taps through to where its data lives. */
export function ReadoutStrip() {
  const { weather, status } = useLocalWeather()
  const caps = useCaps()
  const [quests] = useStored<Quest[]>(QUESTS_KEY, SEED_QUESTS)
  const [, setNav] = useStored<Nav>(NAV_KEY, { tab: 0, subs: [] })
  const active = quests.filter((q) => q.completedAt == null).length
  const boxes = readouts({ weather, weatherStatus: status, caps, activeQuests: active })

  const go = (r: Readout) => {
    if (r.id === 'caps') return openOverlay('terminal')
    const t = NAV_TARGET[r.id]
    if (!t) return
    setNav((prev) => navTo(prev, t.tab, t.sub))
    emit({ type: 'tab-change', tab: t.tabId })
  }
  const hint = (r: Readout) => (r.id === 'caps' ? 'open the terminal' : `open ${NAV_TARGET[r.id]?.tabId} > ${NAV_TARGET[r.id]?.subId}`)

  return (
    <div className="status-strip">
      {boxes.map((r) => (
        <button
          key={r.id}
          type="button"
          className={`readout readout--${r.id}${r.dim ? ' is-dim' : ''}`}
          onClick={() => go(r)}
          title={`${r.label}: ${r.value} ${r.sub} (${hint(r)})`}
          aria-label={`${r.label} ${r.value} ${r.sub}. Tap to ${hint(r)}.`}
        >
          <ReadoutGlyph id={r.id} />
          <span className="readout__value">{r.value}</span>
          <span className="readout__meta">
            <span className="readout__label">{r.label}</span>
            <span className="readout__sub">{r.sub}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Tiles shown in the EFFECTS column before it collapses the rest into "+N". */
const MAX_TILES = 5

/**
 * EFFECTS: a column of icon tiles down the left of the figure (one per active effect).
 * Tapping the column opens the frosted list with names, modifiers and notes.
 */
export function EffectsList() {
  const now = useClock(60_000)
  const { weather } = useLocalWeather()
  const battery = useBattery()
  const radio = useNowPlaying()
  const caps = useCaps()
  const day = useDaylight()
  const [quests] = useStored<Quest[]>(QUESTS_KEY, SEED_QUESTS)
  const [open, setOpen] = useState(false)
  const today = questsDoneToday(quests, now)
  const list = statusEffects({ hour: now.getHours(), weather, battery, radio, questsToday: today, streak: caps, daylight: day })
  const shown = list.slice(0, list.length > MAX_TILES ? MAX_TILES - 1 : MAX_TILES)
  const more = list.length - shown.length

  return (
    <section className="status-effects" data-open={open || undefined} data-no-swipe>
      <button
        type="button"
        className="status-effects__tiles"
        aria-expanded={open}
        aria-controls="status-effects-list"
        aria-label={`Effects: ${list.length} active. ${open ? 'Hide' : 'Show'} details.`}
        title="Effects"
        onClick={() => setOpen((o) => !o)}
      >
        {shown.map((e) => (
          <span key={e.id} className={`fx-tile fx-tile--${e.tone}`}>
            <EffectGlyph id={e.id} tone={e.tone} />
          </span>
        ))}
        {more > 0 && <span className="fx-tile fx-tile--more">+{more}</span>}
        {list.length === 0 && <span className="fx-tile fx-tile--none">0</span>}
      </button>
      <ul id="status-effects-list" className="status-effects__list" aria-label="Active effects">
        {list.length === 0 ? (
          <li className="fx fx--none">NO ACTIVE EFFECTS</li>
        ) : (
          list.map((e) => (
            <li key={e.id} className={`fx fx--${e.tone}`}>
              <EffectGlyph id={e.id} tone={e.tone} />
              <span className="fx__name">{e.name}</span>
              <span className="fx__mod">{e.mod}</span>
              <span className="fx__note">{e.note}</span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
