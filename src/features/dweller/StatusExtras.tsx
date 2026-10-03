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
import { EmoteGlyph, ReadoutGlyph } from './glyphs'
import { NAV_KEY, NAV_TARGET, navTo, readouts, type Nav, type Readout } from './statusReadouts'
import { questsDoneToday, statusEffects } from './statusEffects'
import type { Gesture } from './vaultboy/behavior'

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/**
 * Floating emote cluster beside the figure. Number keys 1-6 work while STATUS is open
 * (not while typing, not under an overlay).
 */
export function EmoteBar() {
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
    <div className="emote-bar" role="toolbar" aria-label="Emotes" data-no-swipe>
      {EMOTES.map((e) => (
        <button
          key={e.id}
          type="button"
          className={`emote-btn${lit === e.id ? ' is-lit' : ''}`}
          data-emote={e.id}
          onClick={() => fire(e.id)}
          aria-label={`${e.label} (key ${e.key})`}
          title={`${e.label}  [${e.key}]`}
        >
          <EmoteGlyph id={e.id} />
        </button>
      ))}
    </div>
  )
}

/** Weather for wherever the dweller is (no GPS prompt from here; MAP/STATS ask for that). */
function useLocalWeather() {
  const { coords } = useLocation()
  return useWeather(coords.lat, coords.lon)
}

/** The four readout boxes under the figure. Each taps through to where its data lives. */
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

/** EFFECTS: always listed beside the figure on wide panels, a toggle + popover on compact ones. */
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

  return (
    <section className="status-effects" data-open={open || undefined} aria-label="Active effects">
      <h3 className="status-effects__title">EFFECTS</h3>
      <button type="button" className="status-effects__toggle" aria-expanded={open} aria-controls="status-effects-list" onClick={() => setOpen((o) => !o)}>
        <span aria-hidden>{open ? '▾' : '▸'}</span> EFFECTS <b>{list.length}</b>
      </button>
      <ul id="status-effects-list" className="status-effects__list">
        {list.length === 0 ? (
          <li className="fx fx--none">NO ACTIVE EFFECTS</li>
        ) : (
          list.map((e) => (
            <li key={e.id} className={`fx fx--${e.tone}`}>
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
