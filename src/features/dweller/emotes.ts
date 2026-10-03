import type { Gesture } from './vaultboy/behavior'

/**
 * STATUS emote controls: the EMOTES fly-out, their number keys, and a tiny
 * module-level bus so StatusPanel can ask whichever figure scene is mounted to gesture.
 * Pure apart from the listener set; no three.js.
 */

export type Emote = { id: Gesture; label: string; key: string }

export const EMOTES: readonly Emote[] = [
  { id: 'wave', label: 'WAVE', key: '1' },
  { id: 'thumbsUp', label: 'THUMBS UP', key: '2' },
  { id: 'flex', label: 'FLEX', key: '3' },
  { id: 'point', label: 'POINT', key: '4' },
  { id: 'cheer', label: 'CHEER', key: '5' },
  { id: 'handsOnHips', label: 'HANDS ON HIPS', key: '6' },
]

/** Number key → emote (1-6), or null for anything else. */
export function emoteForKey(key: string): Gesture | null {
  return EMOTES.find((e) => e.key === key)?.id ?? null
}

type Listener = (g: Gesture) => void
const listeners = new Set<Listener>()

/** Ask the mounted figure to play an emote. Returns false when no figure is listening. */
export function requestEmote(g: Gesture): boolean {
  listeners.forEach((fn) => fn(g))
  return listeners.size > 0
}

/** Figure scenes subscribe while mounted. Returns an unsubscribe fn. */
export function onEmote(fn: Listener): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/* ---------- the procedural Dweller's stand-in reactions (it has no gesture rig) ---------- */

export type DwellerMove = 'hop' | 'spin' | 'bounce'

/** Which simple whole-body move answers each emote on the procedural Dweller. */
export const DWELLER_MOVE: Record<Gesture, DwellerMove> = {
  wave: 'hop',
  cheer: 'hop',
  thumbsUp: 'bounce',
  flex: 'bounce',
  point: 'spin',
  handsOnHips: 'spin',
}

export const MOVE_SECS: Record<DwellerMove, number> = { hop: 0.7, bounce: 0.9, spin: 1.1 }

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)

/**
 * Root offset for a move `t` seconds in: lift (world units) and extra yaw (radians).
 * Both return to exactly zero at the end so the walk loop picks up where it was.
 */
export function moveOffset(move: DwellerMove, t: number): { y: number; yaw: number } {
  const secs = MOVE_SECS[move]
  if (!(t > 0) || t >= secs) return { y: 0, yaw: 0 }
  const p = t / secs
  switch (move) {
    case 'hop':
      return { y: 0.22 * Math.sin(Math.PI * p), yaw: 0 }
    case 'bounce':
      // two quick little hops
      return { y: 0.09 * Math.abs(Math.sin(2 * Math.PI * p)), yaw: 0 }
    case 'spin':
      return { y: 0.05 * Math.sin(Math.PI * p), yaw: 2 * Math.PI * ease(p) }
  }
}
