import { hashString } from '../../lib/seed'

/**
 * Playful, deterministic WG (weight) and VAL (caps) for every INV item, plus the
 * carry-weight readout. Nothing here affects behavior; it's inventory flavor.
 */

export type WgVal = { wg: number; val: number }

/** A holotape weighs 0.1; its value is 2-10 caps (stable per address) plus 1 per play. */
export const holotapeWgVal = (t: { url: string; uses?: number }): WgVal => ({
  wg: 0.1,
  val: 2 + (hashString(t.url) % 9) + Math.min(t.uses ?? 0, 90),
})

/** The built-in ROBCO TERMINAL holotape. */
export const ROBCO_WGVAL: WgVal = { wg: 0.1, val: 77 }

/** An AID dose weighs 0.5 and gains 2 caps per use, like a well-loved stimpak. */
export const aidWgVal = (a: { uses: number }): WgVal => ({ wg: 0.5, val: 10 + Math.min(a.uses, 200) * 2 })

/** Paper is weightless; a note is worth a cap per 25 words (minimum 1). */
export const noteWgVal = (n: { body: string }): WgVal => ({
  wg: 0,
  val: Math.max(1, Math.ceil(n.body.split(/\s+/).filter(Boolean).length / 25)),
})

/** Carry capacity from Strength, the way the wasteland has always done it. */
export const carryCapacity = (strength: number) => 200 + 10 * strength

export function totals(items: WgVal[]): WgVal {
  let wg = 0
  let val = 0
  for (const i of items) {
    wg += i.wg
    val += i.val
  }
  return { wg: Math.round(wg * 10) / 10, val }
}

/** "0.1", "2", "12.5": one decimal only when needed. */
export const fmtWg = (wg: number) => {
  const r = Math.round(wg * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
