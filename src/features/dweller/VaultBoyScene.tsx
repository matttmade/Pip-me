import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import {
  mulberry32,
  on,
  readStored,
  subscribeStored,
  useCoarsePointer,
  useEffectsConfig,
  usePageVisible,
  usePrefersReducedMotion,
  type Rng,
} from '../../lib/contracts'
import { NO_PERKS, PERKS_KEY } from '../perks/perks'
import { useHeadshot } from './headshot'
import { eventGesture, PERK_GESTURE, tapGesture } from './vaultboy/behavior'
import { createVaultBoyEngine, type VaultBoyEngine } from './vaultboy/vaultBoyEngine'

const TAP_SLOP = 10

/**
 * The rigged Vault Boy hologram (user-supplied kit). Lazy-loaded by StatusPanel, so three and
 * the GLB only load with STAT. Walks in place, takes a beat every so often, and gestures
 * when tapped or when something good happens elsewhere in the app.
 */
export default function VaultBoyScene({ onFail }: { onFail: (err: unknown) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<VaultBoyEngine | null>(null)
  const [cfg] = useEffectsConfig()
  const [headshot] = useHeadshot()
  const visible = usePageVisible()
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const latest = useRef({ hue: cfg.hue, glow: cfg.glow, headshot, visible, onFail })
  useLayoutEffect(() => {
    latest.current = { hue: cfg.hue, glow: cfg.glow, headshot, visible, onFail }
  })
  const rng = useRef<Rng | null>(null)
  const down = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 320
    canvas.className = 'dweller-canvas dweller-canvas--smooth vaultboy-canvas'
    el.appendChild(canvas)
    el.dataset.source = 'vaultboy'
    let cancelled = false
    let live: VaultBoyEngine | null = null
    const onLost = (e: Event) => {
      e.preventDefault()
      latest.current.onFail(new Error('WebGL context lost'))
    }
    canvas.addEventListener('webglcontextlost', onLost)

    const measure = () => {
      if (!live) return
      const w = el.clientWidth
      const h = el.clientHeight
      const zoom = w > 0 ? el.getBoundingClientRect().width / w : 1
      live.resize(w, h, (window.devicePixelRatio || 1) * Math.min(2, Math.max(0.5, zoom || 1)))
    }
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    ro?.observe(el)

    const { hue, glow } = latest.current
    createVaultBoyEngine(canvas, { hue, glow, animate: !reduced, coarse })
      .then((e) => {
        if (cancelled) return e.dispose()
        live = engine.current = e
        el.dataset.ready = 'true'
        measure()
        e.setHue(latest.current.hue)
        e.setGlow(latest.current.glow)
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
      delete el.dataset.ready
      canvas.remove()
    }
  }, [reduced, coarse])

  // App events → gestures. Perks are noticed through the store (the earned list grows).
  useEffect(() => {
    const offEvents = on('*', (e) => {
      const g = eventGesture(e)
      if (g) engine.current?.react(g)
    })
    let earned = readStored(PERKS_KEY, NO_PERKS).length
    const offPerks = subscribeStored(PERKS_KEY, () => {
      const n = readStored(PERKS_KEY, NO_PERKS).length
      if (n > earned) engine.current?.react(PERK_GESTURE)
      earned = n
    })
    return () => {
      offEvents()
      offPerks()
    }
  }, [])

  useEffect(() => engine.current?.setHue(cfg.hue), [cfg.hue])
  useEffect(() => engine.current?.setGlow(cfg.glow), [cfg.glow])
  useEffect(() => void engine.current?.setHeadshot(headshot), [headshot])
  useEffect(() => engine.current?.setRunning(visible), [visible])

  const tap = () => {
    rng.current ??= mulberry32(Date.now() | 0)
    engine.current?.react(tapGesture(rng.current))
  }
  const onPointerDown = (e: PointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: PointerEvent) => {
    const d = down.current
    down.current = null
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) <= TAP_SLOP) tap()
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    tap()
  }

  return (
    <div
      ref={host}
      className="dweller-scene vaultboy-scene"
      data-no-swipe
      role="button"
      tabIndex={0}
      aria-label="Vault Boy, walking in place. Tap for a gesture."
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (down.current = null)}
      onKeyDown={onKeyDown}
    />
  )
}
