import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  emit,
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
import { onEmote } from './emotes'
import { figureTap, onFigureFacing } from './figureTap'
import { eventGesture, PERK_GESTURE, tapGesture } from './vaultboy/behavior'
import { dragToAngle, KEY_TURN, releaseVelocity, type Sample } from './vaultboy/spin'
import { createVaultBoyEngine, type VaultBoyEngine } from './vaultboy/vaultBoyEngine'

const TAP_SLOP = 10

/** Drag-to-spin controls, once the engine is up. */
const spinner = (e: VaultBoyEngine | null) => e

type Press = { id: number; x0: number; y0: number; x: number; samples: Sample[]; dragging: boolean }

/**
 * The rigged Vault Boy hologram (user-supplied kit). Lazy-loaded by StatusPanel, so three and
 * the GLB only load with STAT. Walks in place, takes a beat every so often, and gestures
 * when tapped or when something good happens elsewhere in the app.
 */
export default function VaultBoyScene({ onFail, onReady }: { onFail: (err: unknown) => void; onReady?: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<VaultBoyEngine | null>(null)
  const [cfg] = useEffectsConfig()
  const visible = usePageVisible()
  const reduced = usePrefersReducedMotion()
  const coarse = useCoarsePointer()
  const latest = useRef({ hue: cfg.hue, glow: cfg.glow, visible, onFail, onReady })
  useLayoutEffect(() => {
    latest.current = { hue: cfg.hue, glow: cfg.glow, visible, onFail, onReady }
  })
  const rng = useRef<Rng | null>(null)
  const down = useRef<Press | null>(null)
  // set once the engine can turn, so ←/→ on the focused figure spin him instead of changing section
  const [canSpin, setCanSpin] = useState(false)

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
        setCanSpin(!!spinner(e))
        latest.current.onReady?.()
      })
      .catch((err) => !cancelled && latest.current.onFail(err))

    return () => {
      cancelled = true
      ro?.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      live?.dispose()
      engine.current = null
      setCanSpin(false)
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
    // Emote buttons / number keys on the STATUS panel.
    const offEmotes = onEmote((g) => engine.current?.react(g))
    return () => {
      offEvents()
      offPerks()
      offEmotes()
    }
  }, [])

  useEffect(() => engine.current?.setHue(cfg.hue), [cfg.hue])
  useEffect(() => engine.current?.setGlow(cfg.glow), [cfg.glow])
  useEffect(() => engine.current?.setRunning(visible), [visible])

  // The equipped weapon (STATUS weapon slot) gets first go at a tap; it asks for its own gesture.
  const tap = (at: { x: number; y: number } | null) => {
    rng.current ??= mulberry32(Date.now() | 0)
    if (!figureTap(at)) engine.current?.react(tapGesture(rng.current))
    emit({ type: 'figure-tapped' })
  }
  // the equipped weapon asks which way he faces (water pistol aim, punch side)
  useEffect(() => (canSpin ? onFigureFacing(() => spinner(engine.current)?.getFacing() ?? 0) : undefined), [canSpin])

  // A short tap fires the weapon / plays a gesture; a sideways drag spins him (and never fires).
  const width = () => host.current?.getBoundingClientRect().width ?? 0
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    down.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, samples: [{ x: e.clientX, t: e.timeStamp }], dragging: false }
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = down.current
    const s = spinner(engine.current)
    if (!d || d.id !== e.pointerId || !s) return
    if (!d.dragging) {
      const dx = e.clientX - d.x0
      if (Math.abs(dx) <= TAP_SLOP || Math.abs(dx) < Math.abs(e.clientY - d.y0)) return
      d.dragging = true
      s.grab()
      try {
        host.current?.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety */
      }
    }
    s.spinBy(dragToAngle(e.clientX - d.x, width()))
    d.x = e.clientX
    d.samples.push({ x: e.clientX, t: e.timeStamp })
    if (d.samples.length > 12) d.samples.shift()
  }
  const onPointerUp = (e: PointerEvent) => {
    const d = down.current
    down.current = null
    if (!d || d.id !== e.pointerId) return
    if (d.dragging) {
      d.samples.push({ x: e.clientX, t: e.timeStamp })
      spinner(engine.current)?.release(reduced ? 0 : releaseVelocity(d.samples, width()))
      return
    }
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) <= TAP_SLOP) tap({ x: e.clientX, y: e.clientY })
  }
  const onPointerCancel = () => {
    if (down.current?.dragging) spinner(engine.current)?.release(0)
    down.current = null
  }
  const onKeyDown = (e: KeyboardEvent) => {
    const s = spinner(engine.current)
    if (s && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault()
      s.spinBy(e.key === 'ArrowRight' ? KEY_TURN : -KEY_TURN)
      return
    }
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    tap(null)
  }

  return (
    <div
      ref={host}
      className="dweller-scene vaultboy-scene"
      data-no-swipe
      role="button"
      tabIndex={0}
      data-own-arrows={canSpin || undefined}
      aria-label={canSpin ? 'Vault Boy, walking in place. Tap for a gesture, drag or use the arrow keys to turn him.' : 'Vault Boy, walking in place. Tap for a gesture.'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
    />
  )
}
