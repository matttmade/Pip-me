import { randInt, rngFrom } from '../../lib/contracts'

export const SPECIAL_KEYS = ['S', 'P', 'E', 'C', 'I', 'A', 'L'] as const
export type SpecialKey = (typeof SPECIAL_KEYS)[number]
export type Special = Record<SpecialKey, number>

export const STAT_MIN = 1
export const STAT_MAX = 10
export const TOTAL_MIN = 28
export const TOTAL_MAX = 40

/**
 * Deterministic S.P.E.C.I.A.L. from a dweller name: every stat 1-10, total 28-40.
 * Each stat gets a seeded "aptitude" weight, then points are dealt one at a time to
 * stats that still have room, so the spread looks lumpy like a real character sheet.
 */
export function generateSpecial(name: string): Special {
  const rng = rngFrom(`special:${name.trim().toUpperCase()}`)
  const total = randInt(rng, TOTAL_MIN, TOTAL_MAX)
  const weights = SPECIAL_KEYS.map(() => 0.15 + rng() ** 2)
  const values = SPECIAL_KEYS.map(() => STAT_MIN)
  let left = total - STAT_MIN * SPECIAL_KEYS.length
  while (left > 0) {
    let sum = 0
    for (let i = 0; i < values.length; i++) if (values[i] < STAT_MAX) sum += weights[i]
    let pick = rng() * sum
    let i = 0
    for (; i < values.length; i++) {
      if (values[i] >= STAT_MAX) continue
      pick -= weights[i]
      if (pick < 0) break
    }
    if (i >= values.length) i = values.findIndex((v) => v < STAT_MAX) // float edge case
    values[i]++
    left--
  }
  return Object.fromEntries(SPECIAL_KEYS.map((k, i) => [k, values[i]])) as Special
}

export const specialTotal = (s: Special) => SPECIAL_KEYS.reduce((n, k) => n + s[k], 0)
