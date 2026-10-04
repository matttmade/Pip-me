/**
 * Drag-to-spin for the STATUS figure: pointer drag → yaw, the coast after release, and
 * which way he is facing relative to the camera. Pure; no three.js, no DOM.
 *
 * Facing is in radians relative to the camera, wrapped to (-π, π]:
 *   0 = facing the viewer, +π/2 = facing screen-right, -π/2 = facing screen-left, ±π = away.
 */

const TAU = Math.PI * 2

/** Dragging across the whole figure turns him this far (radians). */
export const DRAG_TURN = Math.PI * 1.5
/** Velocity half-life while coasting (seconds): a flick coasts, then eases to a stop. */
export const COAST_HALF_LIFE = 0.28
/** Below this (rad/s) the coast stops. */
export const COAST_MIN = 0.05
/** Fastest coast a flick can start (rad/s). */
export const COAST_MAX = 14
/** One arrow-key press (radians). */
export const KEY_TURN = Math.PI / 12

/** Wrap any angle into (-π, π]. */
export function wrapAngle(a: number): number {
  if (!Number.isFinite(a)) return 0
  const w = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI
  return w === -Math.PI ? Math.PI : w
}

/** Horizontal drag of `dx` px over a figure `width` px wide → yaw change (radians). Right drag turns him to face right. */
export function dragToAngle(dx: number, width: number): number {
  if (!(width > 0) || !Number.isFinite(dx)) return 0
  return (dx / width) * DRAG_TURN
}

export type Sample = { x: number; t: number }

/**
 * Release velocity (rad/s) from the last pointer samples (x px, t ms), looking back at most
 * `windowMs`. A pause before letting go means no coast. Clamped to ±COAST_MAX.
 */
export function releaseVelocity(samples: readonly Sample[], width: number, windowMs = 90): number {
  if (samples.length < 2 || !(width > 0)) return 0
  const last = samples[samples.length - 1]
  let first = last
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break
    first = samples[i]
  }
  const dt = (last.t - first.t) / 1000
  if (dt <= 0) return 0
  const v = dragToAngle(last.x - first.x, width) / dt
  return Math.max(-COAST_MAX, Math.min(COAST_MAX, v))
}

/** One frame of coasting: how far he turns this frame and the slower velocity after it. */
export function coastStep(vel: number, dt: number): { turn: number; vel: number } {
  if (!(dt > 0) || Math.abs(vel) < COAST_MIN) return { turn: 0, vel: Math.abs(vel) < COAST_MIN ? 0 : vel }
  const k = Math.LN2 / COAST_HALF_LIFE
  const next = vel * Math.exp(-k * dt)
  // exact integral of the exponential decay over the frame
  const turn = (vel - next) / k
  return { turn, vel: Math.abs(next) < COAST_MIN ? 0 : next }
}

/** Facing relative to the camera, from his own yaw and the camera's orbit yaw (both world, radians). */
export const facingFromYaw = (figureYaw: number, cameraYaw: number) => wrapAngle(figureYaw - cameraYaw)

/**
 * Where a water-pistol shot goes for a facing: `x` is sideways on screen (-1 left … 1 right),
 * `z` is toward the viewer (1 = straight at the glass, -1 = away into the screen).
 */
export function squirtAim(facing: number): { x: number; z: number } {
  const f = wrapAngle(facing)
  return { x: Math.sin(f), z: Math.cos(f) }
}
