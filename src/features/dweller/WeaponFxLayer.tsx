import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import type { Rng } from '../../lib/contracts'
import { dropAt, shotLength, spawnSquirt, type Aim, type Drop, type Pt } from './weaponFx'

export type WeaponFxHandle = {
  /** A fist hitting the glass at a viewport point. */
  punch: (at: Pt) => void
  /** A water-pistol burst from a viewport point, toward one side. `still`: splats only, no flight or run (reduced motion). */
  squirt: (from: Pt, dir: 1 | -1, rng: Rng, still?: boolean, facing?: Aim) => void
}

type Shot = { kind: 'punch'; at: Pt; t0: number; end: number; rays: number[] } | { kind: 'squirt'; drops: Drop[]; t0: number; end: number }

const PUNCH_MS = 650

/**
 * A canvas laid over the CRT (portalled into it by WeaponSlot) for weapon hits: punch
 * impacts and water drops that splat on the glass and run. Phosphor-tinted from the live
 * tokens. Its animation loop only runs while something is on screen.
 */
export function WeaponFxLayer({ ref }: { ref?: Ref<WeaponFxHandle> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const shots = useRef<Shot[]>([])
  const raf = useRef(0)

  // viewport → canvas-local CSS px (the CRT may be scaled by the device camera)
  const local = (p: Pt): Pt => {
    const c = canvas.current
    if (!c) return p
    const r = c.getBoundingClientRect()
    const sx = c.offsetWidth / (r.width || 1)
    const sy = c.offsetHeight / (r.height || 1)
    return { x: (p.x - r.left) * sx, y: (p.y - r.top) * sy }
  }

  // `now` is the rAF timestamp (same clock as performance.now)
  const draw = (now: number) => {
    raf.current = 0
    const c = canvas.current
    const g = c?.getContext('2d')
    if (!c || !g) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = c.offsetWidth
    const h = c.offsetHeight
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    const css = getComputedStyle(c)
    const pip = css.getPropertyValue('--pip').trim() || 'lime'
    const hi = css.getPropertyValue('--pip-hi').trim() || pip
    shots.current = shots.current.filter((s) => now - s.t0 < s.end)
    g.shadowColor = pip
    for (const s of shots.current) {
      const t = now - s.t0
      if (s.kind === 'punch') drawPunch(g, s.at, s.rays, t / PUNCH_MS, pip, hi)
      else drawDrops(g, s.drops, t, pip, hi)
    }
    if (shots.current.length) raf.current = requestAnimationFrame(draw)
  }

  const start = () => {
    if (!raf.current) raf.current = requestAnimationFrame(draw)
  }

  useImperativeHandle(ref, () => ({
    punch(at) {
      const rays = Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2 + Math.random() * 0.5)
      shots.current.push({ kind: 'punch', at: local(at), t0: performance.now(), end: PUNCH_MS, rays })
      start()
    },
    squirt(from, dir, rng, still, facing) {
      const c = canvas.current
      if (!c) return
      const spawned = spawnSquirt(rng, local(from), { w: c.offsetWidth, h: c.offsetHeight }, dir, 7, facing)
      const drops = still ? spawned.map((d) => ({ ...d, delay: 0, flight: 1, run: 0 })) : spawned
      shots.current.push({ kind: 'squirt', drops, t0: performance.now(), end: shotLength(drops) })
      start()
    },
  }))

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return <canvas ref={canvas} className="weapon-fx" aria-hidden />
}

/** Glass-crack starburst + ring where the fist lands. */
function drawPunch(g: CanvasRenderingContext2D, at: Pt, rays: number[], p: number, pip: string, hi: string) {
  if (p >= 1) return
  const grow = 1 - (1 - Math.min(1, p * 3)) ** 3
  const fade = p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6
  g.save()
  g.globalAlpha = fade
  g.shadowBlur = 10
  g.strokeStyle = hi
  g.lineCap = 'round'
  g.lineWidth = 2
  const lens = rays.map((_, i) => (34 + (i % 3) * 18) * grow)
  rays.forEach((a, i) => {
    const len = lens[i]
    const kink = a + (i % 2 ? 0.22 : -0.22)
    g.beginPath()
    g.moveTo(at.x + Math.cos(a) * 5, at.y + Math.sin(a) * 5)
    g.lineTo(at.x + Math.cos(a) * len * 0.55, at.y + Math.sin(a) * len * 0.55)
    g.lineTo(at.x + Math.cos(kink) * len, at.y + Math.sin(kink) * len)
    g.stroke()
  })
  // spider-web cross cracks between neighbouring rays
  g.lineWidth = 1.2
  g.beginPath()
  rays.forEach((a, i) => {
    const b = rays[(i + 1) % rays.length]
    const r1 = Math.min(lens[i], lens[(i + 1) % rays.length]) * 0.42
    g.moveTo(at.x + Math.cos(a) * r1, at.y + Math.sin(a) * r1)
    g.lineTo(at.x + Math.cos(b) * r1 * 0.9, at.y + Math.sin(b) * r1 * 0.9)
  })
  g.stroke()
  g.strokeStyle = pip
  g.lineWidth = 2.5 * (1 - p)
  g.beginPath()
  g.arc(at.x, at.y, 10 + 46 * Math.min(1, p * 1.6), 0, Math.PI * 2)
  g.stroke()
  g.fillStyle = hi
  g.globalAlpha = fade * (1 - p)
  g.beginPath()
  g.arc(at.x, at.y, 7 * (1 - p), 0, Math.PI * 2)
  g.fill()
  g.restore()
}

/** A wobbly closed blob (smoothed polygon) — the splat shape, stable per drop. */
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, squash: number) {
  const n = 11
  const pts = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2
    const j = 0.78 + 0.32 * Math.abs(Math.sin(seed * 12.9898 + k * 78.233))
    return { x: x + Math.cos(a) * r * j, y: y + Math.sin(a) * r * j * squash }
  })
  g.beginPath()
  for (let k = 0; k <= n; k++) {
    const p = pts[k % n]
    const q = pts[(k + 1) % n]
    const mx = (p.x + q.x) / 2
    const my = (p.y + q.y) / 2
    if (k === 0) g.moveTo(mx, my)
    else g.quadraticCurveTo(p.x, p.y, mx, my)
  }
  g.closePath()
}

/** Flying drops (streaking teardrops) and splats that run down the glass. */
function drawDrops(g: CanvasRenderingContext2D, drops: Drop[], t: number, pip: string, hi: string) {
  g.save()
  g.lineCap = 'round'
  drops.forEach((d, i) => {
    const f = dropAt(d, t)
    if (f.phase === 'wait' || f.phase === 'gone') return
    g.shadowBlur = 8
    if (f.phase === 'fly') {
      // motion streak back along the path, then the drop and its glint
      const back = dropAt(d, Math.max(d.delay, t - 45))
      if (back.phase === 'fly') {
        g.globalAlpha = 0.5
        g.strokeStyle = pip
        g.lineWidth = f.r * 1.1
        g.beginPath()
        g.moveTo(back.x, back.y)
        g.lineTo(f.x, f.y)
        g.stroke()
      }
      g.globalAlpha = f.alpha
      g.fillStyle = pip
      g.beginPath()
      g.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = hi
      g.beginPath()
      g.arc(f.x - f.r * 0.3, f.y - f.r * 0.3, f.r * 0.32, 0, Math.PI * 2)
      g.fill()
      return
    }
    // the wet streak it leaves running down the glass
    if (f.trail > 1) {
      g.strokeStyle = pip
      g.globalAlpha = f.alpha * 0.35
      g.lineWidth = Math.max(1.5, f.r * 0.55)
      g.beginPath()
      g.moveTo(f.x, f.y - f.trail)
      g.lineTo(f.x, f.y)
      g.stroke()
    }
    // splat: translucent wobbly blob, bright rim, a couple of flecks, a glint
    blob(g, f.x, f.y, f.r, i + 1, 0.9)
    g.fillStyle = pip
    g.globalAlpha = f.alpha * 0.22
    g.fill()
    g.globalAlpha = f.alpha * 0.9
    g.strokeStyle = hi
    g.lineWidth = 1.3
    g.stroke()
    g.shadowBlur = 4
    for (let k = 0; k < 2; k++) {
      const a = i * 1.7 + k * 2.6
      const dist = f.r * (1.3 + 0.35 * k)
      g.fillStyle = pip
      g.globalAlpha = f.alpha * 0.7
      g.beginPath()
      g.arc(f.x + Math.cos(a) * dist, f.y - f.trail + Math.sin(a) * dist, Math.max(1.2, f.r * (0.14 + 0.06 * k)), 0, Math.PI * 2)
      g.fill()
    }
    g.globalAlpha = f.alpha
    g.strokeStyle = hi
    g.lineWidth = Math.max(1.2, f.r * 0.14)
    g.beginPath()
    g.arc(f.x, f.y, f.r * 0.55, Math.PI * 1.1, Math.PI * 1.45)
    g.stroke()
  })
  g.restore()
}
