import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useEffectsConfig } from '../effects/EffectsProvider'
import { usePageVisible, usePrefersReducedMotion } from '../lib/hooks'
import { buildCursors } from './cursors'
import { CrtGlass } from './CrtGlass'
import { useDeviceSettings, useView, warpAutoDefault, type View } from './deviceSettings'
import { Dock } from './Dock'
import { ScreenRim } from './ScreenRim'
import { ViewContext } from './viewContext'
import { Disclaimer } from '../shell/Disclaimer'
import { armLayout, DESIGN, isCompact, screenRect, type Insets } from './scene'

/**
 * The true layout viewport + safe-area insets, from one invisible full-screen probe that's
 * watched with a ResizeObserver. window.innerHeight / a one-off env() read are unreliable when
 * iOS launches the Home Screen web app (they can report the pre-fullscreen size and never fire
 * resize), which left a gap at the bottom and content under the status bar.
 */
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true

/**
 * iOS 26 Home Screen apps (WebKit bug 301108) report a viewport one status bar short of the
 * screen bottom, and blur whatever sits under the status bar. There, size the stage to the
 * large viewport (100lvh is the full screen) and keep the frame clear of the blur.
 */
const STANDALONE_TOP_CLEAR = 22

function useViewport() {
  const measure = (el: HTMLElement, tall: HTMLElement) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const standalone = isStandalone()
    const h = Math.round(r.height) || window.innerHeight
    const top = parseFloat(s.paddingTop) || 0
    return {
      w: Math.round(r.width) || window.innerWidth,
      h: standalone ? Math.max(h, Math.round(tall.getBoundingClientRect().height)) : h,
      standalone,
      safe: {
        top: standalone && top > 0 ? top + STANDALONE_TOP_CLEAR : top,
        right: parseFloat(s.paddingRight) || 0,
        bottom: parseFloat(s.paddingBottom) || 0,
        left: parseFloat(s.paddingLeft) || 0,
      },
    }
  }
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight, standalone: false, safe: { top: 0, right: 0, bottom: 0, left: 0 } as Insets }))
  useLayoutEffect(() => {
    const probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;inset:0;visibility:hidden;pointer-events:none;z-index:-1;box-sizing:border-box;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
    const tall = document.createElement('div')
    tall.setAttribute('aria-hidden', 'true')
    tall.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:100vh;height:100lvh;visibility:hidden;pointer-events:none;z-index:-1'
    document.body.append(probe, tall)
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() =>
        setVp((prev) => {
          const next = measure(probe, tall)
          const same = prev.w === next.w && prev.h === next.h && prev.standalone === next.standalone && (Object.keys(next.safe) as (keyof Insets)[]).every((k) => prev.safe[k] === next.safe[k])
          return same ? prev : next
        }),
      )
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(probe)
    ro.observe(tall)
    const events: [EventTarget | undefined, string][] = [
      [window, 'resize'],
      [window, 'orientationchange'],
      [window, 'pageshow'],
      [window.visualViewport ?? undefined, 'resize'],
      [document, 'visibilitychange'],
    ]
    events.forEach(([t, e]) => t?.addEventListener(e, update))
    // iOS standalone sometimes settles insets a moment after launch without any event
    const late = [150, 600, 1500].map((ms) => window.setTimeout(update, ms))
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      events.forEach(([t, e]) => t?.removeEventListener(e, update))
      late.forEach(clearTimeout)
      probe.remove()
      tall.remove()
    }
  }, [])
  return vp
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** Pointer-driven parallax: writes --px/--py (-1..1, eased) on the stage without re-rendering. */
function useParallax(el: React.RefObject<HTMLDivElement | null>, on: boolean) {
  useEffect(() => {
    const node = el.current
    if (!node || !on) return
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0
    let raf = 0
    const t0 = performance.now()
    const move = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1
      ty = (e.clientY / window.innerHeight) * 2 - 1
    }
    const tick = (now: number) => {
      const idle = (now - t0) / 1000
      // a slow idle sway so the scene breathes even without a mouse
      const gx = tx + Math.sin(idle * 0.35) * 0.1
      const gy = ty + Math.cos(idle * 0.27) * 0.08
      x += (gx - x) * 0.16
      y += (gy - y) * 0.16
      node.style.setProperty('--px', x.toFixed(4))
      node.style.setProperty('--py', y.toFixed(4))
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move)
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
      node.style.setProperty('--px', '0')
      node.style.setProperty('--py', '0')
    }
  }, [el, on])
}

/**
 * Two ways to look at the Pip-Me: SCREEN (the CRT fills the window, glowing rim) and ARM
 * (the user's photo composite with the live screen pinned on the Pip-Boy glass, parallaxed).
 * The live UI stays mounted in the same place in the tree in both, so switching views never
 * restarts the Dweller, the radio or the map. Phones always get SCREEN and no dock.
 */
export function DeviceStage({ children }: { children: ReactNode }) {
  const vp = useViewport()
  const [stored, setView] = useView()
  const [device] = useDeviceSettings()
  const [cfg] = useEffectsConfig()
  const reduced = usePrefersReducedMotion()
  const visible = usePageVisible()
  const compact = isCompact(vp.w) || vp.h < 520
  const view: View = compact ? 'screen' : stored
  const [degauss, setDegauss] = useState(false)
  const [switching, setSwitching] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const warp = device.warp ?? warpAutoDefault()
  const pipCursor = device.cursor !== false
  const cursors = useMemo(() => buildCursors(cfg.hue), [cfg.hue])

  useParallax(stage, view === 'arm' && !reduced && visible)

  const degaussNow = useCallback(() => {
    setDegauss(true)
    window.setTimeout(() => setDegauss(false), 900)
  }, [])

  // quick CRT-style blink between views instead of tweening the live UI's size
  const changeView = useCallback(
    (v: View) => {
      if (v === view) return
      if (reduced) return setView(v)
      setSwitching(true)
      window.setTimeout(() => {
        setView(v)
        window.setTimeout(() => setSwitching(false), 60)
      }, 180)
    },
    [view, reduced, setView],
  )

  useEffect(() => {
    if (compact) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'v') changeView(view === 'arm' ? 'screen' : 'arm')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [compact, view, changeView])

  const ctx = useMemo(() => ({ view, canArm: !compact, setView: changeView }), [view, compact, changeView])

  let front: React.CSSProperties
  let host: React.CSSProperties
  let inner: React.CSSProperties
  let arm: ReturnType<typeof armLayout> | null = null
  if (view === 'arm') {
    arm = armLayout(vp.w, vp.h)
    front = { left: arm.pipboy.x, top: arm.pipboy.y, width: arm.pipboy.w, height: arm.pipboy.h }
    host = { left: arm.screen.x, top: arm.screen.y, width: arm.screen.w, height: arm.screen.h, borderRadius: arm.screen.r }
    inner = { width: DESIGN.w, height: DESIGN.h, transform: `scale(${arm.uiScale})`, transformOrigin: '0 0' }
  } else {
    const r = screenRect(vp.w, vp.h, vp.safe)
    front = { left: 0, top: 0, width: '100%', height: '100%' }
    host = { left: r.x, top: r.y, width: r.w, height: r.h }
    inner = { width: '100%', height: '100%' }
  }

  const cursorVars = pipCursor
    ? ({ '--cur-arrow': cursors.arrow, '--cur-hover': cursors.hover, '--cur-drag': cursors.drag } as React.CSSProperties)
    : {}

  return (
    <ViewContext.Provider value={ctx}>
      <div
        ref={stage}
        className={`stage stage--${view}${compact ? ' stage--compact' : ''}${switching ? ' is-switching' : ''}`}
        // Home Screen app: the full screen, not the short viewport iOS reports
        style={vp.standalone ? { bottom: 'auto', height: vp.h } : undefined}
      >
        {arm && (
          <div className="scene" aria-hidden>
            <img className="scene__layer scene__bg" src="/scene/background.webp" alt="" draggable={false} />
            <img
              className="scene__layer scene__arm"
              src="/scene/arm.webp"
              alt=""
              draggable={false}
              style={{ left: arm.arm.x, top: arm.arm.y, width: arm.arm.w, height: arm.arm.h }}
            />
          </div>
        )}
        {/* one moving layer: the live screen sits UNDER the Pip-Boy photo, whose glass is cut out */}
        <div className={`front front--${view}`} style={front}>
          <div className={`screen-host screen-host--${view}${degauss ? ' is-degaussing' : ''}${pipCursor ? ' has-pip-cursor' : ''}`} style={{ ...host, ...cursorVars }}>
            <div className="screen-host__inner" style={inner}>
              <CrtGlass curvature={cfg.curvature} warp={warp}>
                {children}
              </CrtGlass>
            </div>
          </div>
          {view === 'screen' && (
            <ScreenRim
              left={Number(host.left)}
              top={Number(host.top)}
              width={Number(host.width)}
              height={Number(host.height)}
              radius={16 + cfg.curvature * 30}
              compact={compact}
            />
          )}
          {arm && <img className="front__pipboy" src="/scene/pipboy.webp" alt="" draggable={false} aria-hidden />}
        </div>
        {view === 'arm' && (
          <>
            <Dock onDegauss={degaussNow} onScreen={() => changeView('screen')} />
            <div className="stage__legal">
              <Disclaimer />
            </div>
          </>
        )}
      </div>
    </ViewContext.Provider>
  )
}
