import type { Rng } from '../../lib/contracts'

/**
 * Water-pistol particles, as pure functions of time so the canvas only has to draw them.
 * A drop flies from the figure toward the glass (growing as it nears the viewer), splats,
 * then runs down the glass and fades. Shot away from the viewer, drops arc into the screen,
 * shrink with distance and never reach the glass.
 */

export type Pt = { x: number; y: number }

export type Drop = {
  from: Pt
  to: Pt
  /** ms after the shot that this drop leaves the nozzle */
  delay: number
  /** ms in the air */
  flight: number
  /** arc height in px (how far the path bows upward) */
  arc: number
  /** splat radius in px */
  r: number
  /** how far it runs down the glass, px */
  run: number
  /** toward the viewer: 1 = at the glass … -1 = away into the screen (no splat) */
  depth: number
}

/** Shot direction: `x` sideways on screen (-1 left … 1 right), `z` toward the viewer (-1 … 1). */
export type Aim = { x: number; z: number }

/** Drops shot this far away from the viewer never hit the glass. */
const AWAY = -0.2
const isAway = (d: Drop) => d.depth < AWAY

export const SPLAT_MS = 1400

/**
 * One trigger pull: a tight burst of `n` drops toward side `dir`. Without `facing` it's aimed
 * at the glass beside the figure; with it, sideways reach follows |facing.x| and a shot away
 * from the viewer (z < 0) lands short, into the screen.
 */
export function spawnSquirt(rng: Rng, from: Pt, size: { w: number; h: number }, dir: 1 | -1, n = 6, facing?: Aim): Drop[] {
  const unit = Math.min(size.w, size.h)
  const z = facing ? Math.max(-1, Math.min(1, facing.z)) : 1
  const away = z < AWAY
  const side = facing ? Math.max(away ? 0.25 : 0.4, Math.abs(facing.x)) : 1
  const aim: Pt = {
    x: from.x + dir * size.w * (0.22 + rng() * 0.18) * side * (away ? 0.6 : 1),
    y: away ? from.y - size.h * (0.03 + rng() * 0.06) : from.y - size.h * (0.08 + rng() * 0.22),
  }
  return Array.from({ length: n }, (_, i) => {
    const spread = unit * 0.07
    return {
      from: { x: from.x + (rng() - 0.5) * 6, y: from.y + (rng() - 0.5) * 6 },
      to: { x: aim.x + (rng() - 0.5) * spread * 2, y: aim.y + (rng() - 0.5) * spread * 1.4 },
      delay: i * (30 + rng() * 25),
      flight: 300 + rng() * 160,
      arc: unit * (0.06 + rng() * 0.06),
      r: Math.max(3, unit * (0.012 + rng() * 0.016)) * (i === 0 ? 1.5 : 1),
      run: unit * (0.04 + rng() * 0.12),
      depth: z,
    }
  })
}

export type DropFrame =
  | { phase: 'wait' }
  | { phase: 'gone' }
  | { phase: 'fly'; x: number; y: number; r: number; alpha: number }
  | { phase: 'splat'; x: number; y: number; r: number; alpha: number; trail: number }

const easeOut = (p: number) => 1 - (1 - p) ** 2

/** Where drop `d` is, `t` ms after the shot. */
export function dropAt(d: Drop, t: number): DropFrame {
  const local = t - d.delay
  if (local < 0) return { phase: 'wait' }
  if (local < d.flight) {
    const p = local / d.flight
    return {
      phase: 'fly',
      x: d.from.x + (d.to.x - d.from.x) * p,
      y: d.from.y + (d.to.y - d.from.y) * p - d.arc * Math.sin(Math.PI * p),
      // at the glass: starts as a speck and swells as it comes closer; away: shrinks into the distance
      r: isAway(d) ? d.r * (0.8 - 0.65 * p) : d.r * (0.25 + 0.75 * p * p),
      alpha: isAway(d) ? 0.9 * (1 - 0.6 * p) : 0.9,
    }
  }
  if (isAway(d)) return { phase: 'gone' }
  const s = local - d.flight
  if (s >= SPLAT_MS) return { phase: 'gone' }
  const q = s / SPLAT_MS
  // splat hits, holds a beat, then slides down leaving a streak
  const slide = q < 0.15 ? 0 : easeOut((q - 0.15) / 0.85) * d.run
  return {
    phase: 'splat',
    x: d.to.x,
    y: d.to.y + slide,
    r: d.r * (q < 0.08 ? 1 + q * 6 : 1.48 - Math.min(0.5, q * 0.6)),
    alpha: q < 0.6 ? 0.85 : 0.85 * (1 - (q - 0.6) / 0.4),
    trail: slide,
  }
}

/** ms until every drop of a shot is gone. */
export const shotLength = (drops: Drop[]) => drops.reduce((m, d) => Math.max(m, d.delay + d.flight + (isAway(d) ? 0 : SPLAT_MS)), 0)
