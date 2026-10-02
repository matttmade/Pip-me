import { lazy, Suspense, useCallback, useEffect, useRef, type ComponentType } from 'react'
import { EffectsProvider, useEffectsConfig } from './effects/EffectsProvider'
import { triggerGlitch } from './effects/glitchScheduler'
import { emit } from './lib/events'
import { closeOverlay, useOverlay, type OverlayId } from './lib/overlay'
import type { OverlayProps } from './lib/contracts'
import { useStored } from './lib/store'
import { BootSequence } from './shell/BootSequence'
import { Disclaimer } from './shell/Disclaimer'
import { PipBoyScreen } from './shell/PipBoyScreen'
import { StatusBar } from './shell/StatusBar'
import { SubTabs } from './shell/SubTabs'
import { TopTabs } from './shell/TopTabs'
import { DataTab } from './tabs/DataTab'
import { InvTab } from './tabs/InvTab'
import { MapTab } from './tabs/MapTab'
import { RadioTab } from './tabs/RadioTab'
import { StatTab } from './tabs/StatTab'

const TABS = [
  { id: 'STAT', subs: ['STATUS', 'SPECIAL', 'PERKS'] },
  { id: 'INV', subs: ['HOLOTAPES', 'AID'] },
  { id: 'DATA', subs: ['QUESTS', 'STATS', 'SYSTEM'] },
  { id: 'MAP', subs: ['LOCAL'] },
  { id: 'RADIO', subs: ['STATIONS'] },
] as const

const OVERLAYS: Record<OverlayId, ComponentType<OverlayProps>> = {
  terminal: lazy(() => import('./features/terminal/Terminal')),
  'headshot-crop': lazy(() => import('./features/dweller/HeadshotCropper')),
}

type Nav = { tab: number; subs: number[] }
const INITIAL_NAV: Nav = { tab: 0, subs: TABS.map(() => 0) }

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

function PipBoy() {
  const [nav, setNav] = useStored<Nav>('nav', INITIAL_NAV)
  const [booted, setBooted] = useStored('booted', false)
  const [cfg] = useEffectsConfig()
  const overlay = useOverlay()
  const tab = TABS[nav.tab] ?? TABS[0]
  const subIndex = Math.min(nav.subs[nav.tab] ?? 0, tab.subs.length - 1)
  const sub = tab.subs[subIndex]

  const goTab = useCallback(
    (i: number) => {
      const next = (i + TABS.length) % TABS.length
      setNav((n) => ({ ...n, tab: next }))
      emit({ type: 'tab-change', tab: TABS[next].id })
      if (cfg.glitch.on && Math.random() < 0.2) triggerGlitch(cfg.glitch.strength * 0.5)
    },
    [setNav, cfg.glitch.on, cfg.glitch.strength],
  )
  const goSub = useCallback(
    (i: number) => {
      setNav((n) => {
        const count = TABS[n.tab].subs.length
        const subs = [...n.subs]
        subs[n.tab] = (i + count) % count
        emit({ type: 'subtab-change', sub: TABS[n.tab].subs[subs[n.tab]] })
        return { ...n, subs }
      })
    },
    [setNav],
  )

  // Keyboard: Q/E top tabs, A/D sub-tabs, Esc closes overlays.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && overlay) return closeOverlay()
      if (overlay || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'q') goTab(nav.tab - 1)
      else if (k === 'e') goTab(nav.tab + 1)
      else if (k === 'a') goSub(subIndex - 1)
      else if (k === 'd') goSub(subIndex + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, nav.tab, subIndex, goTab, goSub])

  // Touch: horizontal swipe on the panel changes sub-tab (maps/canvases opt out with data-no-swipe).
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement
    touch.current = t.closest('[data-no-swipe], input, textarea') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) goSub(subIndex + (dx < 0 ? 1 : -1))
  }

  const Overlay = overlay ? OVERLAYS[overlay.id] : null

  return (
    <PipBoyScreen>
      {!booted ? (
        <BootSequence onDone={() => setBooted(true)} />
      ) : (
        <div className="pip-layout">
          <header className="pip-header">
            <TopTabs tabs={TABS.map((t) => t.id)} active={nav.tab} onChange={goTab} />
            <SubTabs subs={tab.subs} active={subIndex} onChange={goSub} />
          </header>
          <main
            id="pip-panel"
            className="pip-panel"
            role="tabpanel"
            aria-labelledby={`tab-${tab.id}`}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {Overlay ? (
              <div className="pip-overlay">
                <Suspense fallback={<p className="loading">LOADING<span className="cursor">▌</span></p>}>
                  <Overlay payload={overlay?.payload} onClose={closeOverlay} />
                </Suspense>
              </div>
            ) : tab.id === 'STAT' ? (
              <StatTab sub={sub} />
            ) : tab.id === 'INV' ? (
              <InvTab sub={sub} />
            ) : tab.id === 'DATA' ? (
              <DataTab sub={sub} />
            ) : tab.id === 'MAP' ? (
              <MapTab />
            ) : (
              <RadioTab />
            )}
          </main>
          <StatusBar />
          <Disclaimer />
        </div>
      )}
    </PipBoyScreen>
  )
}

export default function App() {
  return (
    <EffectsProvider>
      <PipBoy />
    </EffectsProvider>
  )
}
