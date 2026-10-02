import { useEffect, useLayoutEffect, useRef } from 'react'
import { useEffectsConfig, usePageVisible, usePrefersReducedMotion, useProfile } from '../../lib/contracts'
import { createDwellerEngine, RENDER_H, RENDER_W, type DwellerEngine } from './dwellerEngine'
import { useHeadshot } from './headshot'

/**
 * three.js Vault Dweller. Lazy-loaded by StatusPanel, so three lives in its own chunk.
 * The canvas is created per mount (StrictMode-safe: a disposed context is never reused).
 */
export default function DwellerScene({ onFail }: { onFail: (err: unknown) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<DwellerEngine | null>(null)
  const [cfg] = useEffectsConfig()
  const [profile] = useProfile()
  const [headshot] = useHeadshot()
  const visible = usePageVisible()
  const reduced = usePrefersReducedMotion()
  const latest = useRef({ hue: cfg.hue, vault: profile.vault, headshot, visible, onFail })
  useLayoutEffect(() => {
    latest.current = { hue: cfg.hue, vault: profile.vault, headshot, visible, onFail }
  })

  useEffect(() => {
    const el = host.current
    if (!el) return
    const canvas = document.createElement('canvas')
    canvas.width = RENDER_W
    canvas.height = RENDER_H
    canvas.className = 'dweller-canvas'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Your Vault Dweller, walking in place')
    el.appendChild(canvas)
    let cancelled = false
    let live: DwellerEngine | null = null
    const onLost = (e: Event) => {
      e.preventDefault()
      latest.current.onFail(new Error('WebGL context lost'))
    }
    canvas.addEventListener('webglcontextlost', onLost)

    const { hue, vault } = latest.current
    createDwellerEngine(canvas, { hue, vault, animate: !reduced })
      .then((e) => {
        if (cancelled) return e.dispose()
        live = engine.current = e
        el.dataset.source = e.source
        e.setHue(latest.current.hue)
        e.setVault(latest.current.vault)
        e.setRunning(latest.current.visible)
        return e.setHeadshot(latest.current.headshot)
      })
      .catch((err) => !cancelled && latest.current.onFail(err))

    return () => {
      cancelled = true
      canvas.removeEventListener('webglcontextlost', onLost)
      live?.dispose()
      engine.current = null
      canvas.remove()
    }
  }, [reduced])

  useEffect(() => engine.current?.setHue(cfg.hue), [cfg.hue])
  useEffect(() => engine.current?.setVault(profile.vault), [profile.vault])
  useEffect(() => void engine.current?.setHeadshot(headshot), [headshot])
  useEffect(() => engine.current?.setRunning(visible), [visible])

  return <div ref={host} className="dweller-scene" data-no-swipe />
}
