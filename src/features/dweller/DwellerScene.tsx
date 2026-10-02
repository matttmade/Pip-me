import { useEffect, useLayoutEffect, useRef } from 'react'
import { useCoarsePointer, useEffectsConfig, usePageVisible, usePrefersReducedMotion, useProfile } from '../../lib/contracts'
import { createDwellerEngine, RENDER_H, RENDER_W, type DwellerEngine } from './dwellerEngine'
import { detailProfile, type DetailLevel } from './fidelity'
import { useHeadshot } from './headshot'

/**
 * three.js Vault Dweller. Lazy-loaded by StatusPanel, so three lives in its own chunk.
 * The canvas is created per mount and per DETAIL level (StrictMode-safe: a disposed context
 * is never reused, and everything is rebuilt cleanly when the level changes).
 */
export default function DwellerScene({ onFail, detail }: { onFail: (err: unknown) => void; detail: DetailLevel }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<DwellerEngine | null>(null)
  const [cfg] = useEffectsConfig()
  const [profile] = useProfile()
  const [headshot] = useHeadshot()
  const visible = usePageVisible()
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const latest = useRef({ hue: cfg.hue, glow: cfg.glow, vault: profile.vault, headshot, visible, onFail })
  useLayoutEffect(() => {
    latest.current = { hue: cfg.hue, glow: cfg.glow, vault: profile.vault, headshot, visible, onFail }
  })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const render = detailProfile(detail, coarse)
    const canvas = document.createElement('canvas')
    canvas.width = RENDER_W
    canvas.height = RENDER_H
    canvas.className = `dweller-canvas${render.smooth ? ' dweller-canvas--smooth' : ''}`
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Your Vault Dweller, walking in place')
    el.appendChild(canvas)
    el.dataset.detail = detail
    let cancelled = false
    let live: DwellerEngine | null = null
    const onLost = (e: Event) => {
      e.preventDefault()
      latest.current.onFail(new Error('WebGL context lost'))
    }
    canvas.addEventListener('webglcontextlost', onLost)

    // Backing-store size follows the box (and the device camera's zoom) on smooth levels.
    const measure = () => {
      if (!live || !render.smooth) return
      const w = el.clientWidth
      const h = el.clientHeight
      const zoom = w > 0 ? el.getBoundingClientRect().width / w : 1
      live.resize(w, h, (window.devicePixelRatio || 1) * Math.min(2, Math.max(0.5, zoom || 1)))
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    ro?.observe(el)

    const { hue, glow, vault } = latest.current
    createDwellerEngine(canvas, { hue, glow, vault, animate: !reduced, profile: render })
      .then((e) => {
        if (cancelled) return e.dispose()
        live = engine.current = e
        el.dataset.source = e.source
        measure()
        e.setHue(latest.current.hue)
        e.setGlow(latest.current.glow)
        e.setVault(latest.current.vault)
        e.setRunning(latest.current.visible)
        return e.setHeadshot(latest.current.headshot)
      })
      .catch((err) => !cancelled && latest.current.onFail(err))

    return () => {
      cancelled = true
      ro?.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      live?.dispose()
      engine.current = null
      canvas.remove()
    }
  }, [reduced, detail, coarse])

  useEffect(() => engine.current?.setHue(cfg.hue), [cfg.hue])
  useEffect(() => engine.current?.setGlow(cfg.glow), [cfg.glow])
  useEffect(() => engine.current?.setVault(profile.vault), [profile.vault])
  useEffect(() => void engine.current?.setHeadshot(headshot), [headshot])
  useEffect(() => engine.current?.setRunning(visible), [visible])

  return <div ref={host} className="dweller-scene" data-no-swipe />
}
