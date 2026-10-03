import { pipRgb, type AppEvent, type Rng } from '../../../lib/contracts'

/**
 * Pure Vault Boy behaviour: figure setting, colour, which gesture answers which app event,
 * and a small director that decides when to break the walk loop for a beat. No three.js.
 */

export type Figure = 'VAULTBOY' | 'DWELLER'
export const FIGURES: readonly Figure[] = ['VAULTBOY', 'DWELLER']
export const FIGURE_KEY = 'dweller:figure'
export const DEFAULT_FIGURE: Figure = 'VAULTBOY'
export const FIGURE_LABEL: Record<Figure, string> = { VAULTBOY: 'VAULT BOY', DWELLER: 'DWELLER' }

/** Anything read back from storage (or a saved preset) → a valid figure. */
export const normalizeFigure = (v: unknown): Figure => (FIGURES.includes(v as Figure) ? (v as Figure) : DEFAULT_FIGURE)

/** The app hue as a `#rrggbb` phosphor colour for vb.setColor (a touch lighter than --pip). */
export function hueToHex(hue: number, lightness = 0.6): string {
  const h = ((hue % 360) + 360) % 360
  return '#' + pipRgb(h, lightness).map((c) => c.toString(16).padStart(2, '0')).join('')
}

export const WALK_CLIP = 'walkInPlace'
export const GESTURES = ['thumbsUp', 'wave', 'handsOnHips', 'flex', 'point', 'cheer'] as const
export type Gesture = (typeof GESTURES)[number]

/** Tap / click on the figure: thumbs-up most of the time, the rest share what's left. */
const TAP_WEIGHTS: [Gesture, number][] = [
  ['thumbsUp', 0.4],
  ['wave', 0.15],
  ['flex', 0.13],
  ['cheer', 0.12],
  ['point', 0.1],
  ['handsOnHips', 0.1],
]
export function tapGesture(rng: Rng): Gesture {
  let x = rng()
  for (const [g, w] of TAP_WEIGHTS) {
    if (x < w) return g
    x -= w
  }
  return 'thumbsUp'
}

/** App events the figure reacts to. Perks earned are handled separately (store subscription). */
export function eventGesture(e: AppEvent): Gesture | null {
  switch (e.type) {
    case 'level-up':
      return 'cheer'
    case 'hack-result':
      return e.success ? 'flex' : null
    default:
      return null
  }
}
export const PERK_GESTURE: Gesture = 'cheer'

export type Beat = { kind: 'pose' | 'clip'; name: string; secs: number }

/** How long a held gesture stays up (tween in + hold), in seconds. */
export const poseSecs = (name: string) => (name === 'wave' ? 2.8 : name === 'cheer' ? 2.2 : 2.0)

/** Ambient beats between walk loops: a pause to look around, or a casual gesture. */
const IDLE_BEATS: Beat[] = [
  { kind: 'clip', name: 'idle', secs: 3.2 },
  { kind: 'clip', name: 'alert', secs: 2.6 },
  { kind: 'pose', name: 'wave', secs: poseSecs('wave') },
  { kind: 'pose', name: 'thumbsUp', secs: poseSecs('thumbsUp') },
  { kind: 'pose', name: 'handsOnHips', secs: poseSecs('handsOnHips') },
  { kind: 'pose', name: 'point', secs: poseSecs('point') },
]
export const idleBeat = (rng: Rng): Beat => IDLE_BEATS[Math.min(IDLE_BEATS.length - 1, Math.floor(rng() * IDLE_BEATS.length))]

export const BEAT_MIN = 12
export const BEAT_MAX = 20
/** Seconds of walking before the next ambient beat. */
export const nextBeatDelay = (rng: Rng) => BEAT_MIN + rng() * (BEAT_MAX - BEAT_MIN)

/** Two reactions this close together (e.g. headshot-set and its perk) keep the first. */
export const REACT_GAP = 0.8

export type Command = { type: 'pose' | 'clip'; name: string }

/**
 * Clock-driven state machine: walk → (every 12-20 s) beat → walk. Reactions (tap, events)
 * interrupt the walk or a beat. Time only advances through tick(), so a paused render loop
 * pauses the schedule too.
 */
export class GestureDirector {
  private time = 0
  private walkLeft: number
  private beatLeft = 0
  private lastReact = -Infinity
  private readonly rng: Rng

  constructor(rng: Rng) {
    this.rng = rng
    this.walkLeft = nextBeatDelay(rng)
  }

  get busy() {
    return this.beatLeft > 0
  }

  /** Advance by dt seconds; returns what the figure should start doing now, if anything. */
  tick(dt: number): Command | null {
    this.time += dt
    if (this.beatLeft > 0) {
      this.beatLeft -= dt
      if (this.beatLeft > 0) return null
      this.beatLeft = 0
      this.walkLeft = nextBeatDelay(this.rng)
      return { type: 'clip', name: WALK_CLIP }
    }
    this.walkLeft -= dt
    if (this.walkLeft > 0) return null
    return this.start(idleBeat(this.rng))
  }

  /** A gesture asked for by the user or an app event. Null when it is swallowed by REACT_GAP. */
  react(name: string): Command | null {
    if (this.time - this.lastReact < REACT_GAP) return null
    this.lastReact = this.time
    return this.start({ kind: 'pose', name, secs: poseSecs(name) })
  }

  private start(b: Beat): Command {
    this.beatLeft = b.secs
    return { type: b.kind, name: b.name }
  }
}
