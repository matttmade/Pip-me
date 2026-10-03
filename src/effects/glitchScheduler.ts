import type { Rng } from '../lib/seed'
import type { EffectsConfig } from './types'

export type Glitch = {
  duration: number // ms
  dy: number // px vertical jump of the whole screen
  scale: number // px max horizontal slice displacement
  seed: number // feTurbulence seed: which rows become slices
  bands: number[] // feFuncR discrete table: 0.5 = no shift
  rgb: number // px RGB split offset, 0 = none
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Milliseconds until the next automatic glitch: frequency ±50%. Infinity when off. */
export function nextDelay(cfg: EffectsConfig['glitch'], rng: Rng): number {
  if (!cfg.on || cfg.frequency <= 0) return Infinity
  return cfg.frequency * 1000 * (0.5 + rng())
}

/** Describe one 80-250ms glitch burst. Pure, so it is testable with a seeded rng. */
export function makeGlitch(strength: number, rgbSplit: boolean, rng: Rng): Glitch {
  const s = clamp01(strength)
  const bands = Array.from({ length: 12 }, () => 0.5)
  const slices = 1 + Math.floor(rng() * 3) // 1-3 shifted slices
  for (let i = 0; i < slices; i++) {
    const idx = 3 + Math.floor(rng() * 6) // fractal noise clusters mid-range, so shift mid bands
    const dir = rng() < 0.5 ? -1 : 1
    bands[idx] = 0.5 + dir * (0.2 + rng() * 0.3)
  }
  return {
    duration: Math.round(80 + rng() * 170),
    dy: rng() < 0.6 ? (rng() < 0.5 ? -1 : 1) * Math.round(1 + s * 3) : 0,
    scale: Math.round(6 + s * 50),
    seed: Math.floor(rng() * 1000),
    bands,
    rgb: rgbSplit ? Math.round(1 + s * 3) : 0,
  }
}

type GlitchRequest = { strength: number; force: boolean }
const requests = new Set<(r: GlitchRequest) => void>()

/** Fire a glitch from anywhere (wrong hack guess, level up, TEST GLITCH). */
export function triggerGlitch(strength = 0.5, opts: { force?: boolean } = {}): void {
  requests.forEach((fn) => fn({ strength, force: !!opts.force }))
}

export function onGlitchRequest(fn: (r: GlitchRequest) => void): () => void {
  requests.add(fn)
  return () => requests.delete(fn)
}
