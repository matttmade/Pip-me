import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useEffectsConfig } from '../effects/EffectsProvider'
import { usePageVisible, usePrefersReducedMotion } from '../lib/hooks'
import { buildCursors } from './cursors'
import { CrtGlass } from './CrtGlass'
import { useDeviceSettings, useView, warpAutoDefault, type View } from './deviceSettings'
import { Dock } from './Dock'
import { ViewContext } from './viewContext'
import { Disclaimer } from '../shell/Disclaimer'
import { armLayout, DESIGN, isCompact, screenRect, type Insets } from './scene'

function readSafeArea(): Insets {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
  document.body.appendChild(probe)
  const s = getComputedStyle(probe)
  const out = { top: parseFloat(s.paddingTop) || 0, right: parseFloat(s.paddingRight) || 0, bottom: parseFloat(s.paddingBottom) || 0, left: parseFloat(s.paddingLeft) || 0 }
  probe.remove()
  return out
}

function useViewport() {
  const read = () => ({ w: window.innerWidth, h: window.innerHeight, safe: readSafeArea() })
  const [vp, setVp] = useState(read)
  useEffect(() => {
    const on = () => setVp(read())
    window.addEventListener('resize', on)
    window.visualViewport?.addEventListener('resize', on)
    return () => {
      window.removeEventListener('resize', on)
      window.visualViewport?.removeEventListener('resize', on)
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
      <div ref={stage} className={`stage stage--${view}${compact ? ' stage--compact' : ''}${switching ? ' is-switching' : ''}`}>
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
          {view === 'screen' && <div className="screen-rim" style={host} aria-hidden />}
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
