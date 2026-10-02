import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { useEffectsConfig } from '../effects/EffectsProvider'
import { usePrefersReducedMotion } from '../lib/hooks'
import { cameraFor, layoutDevice, type Insets } from './camera'
import { ControlPanel } from './ControlPanel'
import { buildCursors } from './cursors'
import { CrtGlass } from './CrtGlass'
import { useDeviceSettings, useZoom, warpAutoDefault } from './deviceSettings'
import { PipMeLogo } from './PipMeLogo'

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

/**
 * The physical Pip-Me 3000: casing, CRT, controls, and a camera that frames either the
 * screen (IN) or the whole device (OUT). The UI inside keeps one flat size in both.
 */
export function DeviceStage({ children }: { children: ReactNode }) {
  const vp = useViewport()
  const [zoom, setZoom] = useZoom()
  const [device] = useDeviceSettings()
  const [cfg] = useEffectsConfig()
  const reduced = usePrefersReducedMotion()
  const [degauss, setDegauss] = useState(false)
  const [ready, setReady] = useState(false)
  const warp = device.warp ?? warpAutoDefault()
  const pipCursor = device.cursor !== false
  const cursors = useMemo(() => buildCursors(cfg.hue), [cfg.hue])
  const cursorVars = pipCursor
    ? ({ '--cur-arrow': cursors.arrow, '--cur-hover': cursors.hover, '--cur-drag': cursors.drag } as React.CSSProperties)
    : undefined

  const L = layoutDevice(vp.w, vp.h, vp.safe)
  const cam = cameraFor(zoom, L, vp.w, vp.h, vp.safe)
  const degaussNow = useCallback(() => {
    setDegauss(true)
    window.setTimeout(() => setDegauss(false), 900)
  }, [])
  const toggle = useCallback(() => setZoom((z) => (z === 'in' ? 'out' : 'in')), [setZoom])

  useLayoutEffect(() => {
    // no camera tween on first paint
    const t = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.toLowerCase() === 'z') toggle()
      else if (e.key === 'Escape' && zoom === 'out') setZoom('in')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, zoom, setZoom])

  const knobSize = L.orientation === 'landscape' ? Math.round(Math.min(72, L.panel.w * 0.3)) : Math.round(Math.min(64, L.panel.w / 5.4))

  return (
    <div className={`stage stage--${zoom}${ready && !reduced ? ' is-animated' : ''}`}>
      <div
        className={`device device--${L.orientation} finish--${device.finish.toLowerCase()}`}
        style={{
          width: L.device.w,
          height: L.device.h,
          transform: `translate3d(${cam.x}px, ${cam.y}px, 0) scale(${cam.scale})`,
          '--bezel': `${L.bezel}px`,
          '--bezel-top': `${L.bezelTop}px`,
        } as React.CSSProperties}
      >
        <div className="device__grain" aria-hidden />
        <button className="device__notch" onClick={toggle} aria-label={zoom === 'in' ? 'Zoom out to device controls' : 'Zoom in to screen'} aria-pressed={zoom === 'out'}>
          <PipMeLogo variant="emboss" />
          <span className="device__notch-icon" aria-hidden>{zoom === 'in' ? '⤢' : '⤡'}</span>
        </button>
        {['tl', 'tr', 'bl', 'br'].map((c) => (
          <span key={c} className={`device__screw device__screw--${c}`} aria-hidden />
        ))}
        <div className="device__well" style={{ left: L.screen.x - 8, top: L.screen.y - 8, width: L.screen.w + 16, height: L.screen.h + 16 }} aria-hidden />
        <div
          className={`device__screen${degauss ? ' is-degaussing' : ''}${pipCursor ? ' has-pip-cursor' : ''}`}
          style={{ left: L.screen.x, top: L.screen.y, width: L.screen.w, height: L.screen.h, ...cursorVars }}
        >
          <CrtGlass curvature={cfg.curvature} warp={warp}>
            {children}
          </CrtGlass>
          {zoom === 'out' && <button className="device__screen-catch" onClick={() => setZoom('in')} aria-label="Zoom in to screen" />}
        </div>
        <div className="device__panel" style={{ left: L.panel.x, top: L.panel.y, width: L.panel.w, height: L.panel.h }}>
          <div inert={zoom === 'in' ? true : undefined}>
            <ControlPanel warp={warp} onDegauss={degaussNow} knobSize={knobSize} />
          </div>
          {zoom === 'in' && <button className="device__panel-catch" onClick={() => setZoom('out')} aria-label="Zoom out to device controls" tabIndex={-1} />}
        </div>
        <span className="device__led" aria-hidden />
      </div>
    </div>
  )
}
