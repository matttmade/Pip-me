/** 32-bit string hash (cyrb-style). Stable across sessions and browsers. */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef ^ str.length
  let h2 = 0x41c6ce57 ^ str.length
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  return h1 >>> 0
}

export type Rng = () => number

/** Deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rngFrom = (seed: string | number): Rng =>
  mulberry32(typeof seed === 'number' ? seed : hashString(seed))

/** Integer in [min, max] inclusive. */
export const randInt = (rng: Rng, min: number, max: number) => min + Math.floor(rng() * (max - min + 1))
