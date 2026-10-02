import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/seed'
import { generateSpecial, SPECIAL_KEYS, specialTotal, STAT_MAX, STAT_MIN, TOTAL_MAX, TOTAL_MIN } from './generateSpecial'

const randomName = (rng: () => number) =>
  Array.from({ length: 1 + Math.floor(rng() * 16) }, () => String.fromCharCode(32 + Math.floor(rng() * 90))).join('')

describe('generateSpecial', () => {
  it('stays within bounds over 1000 random seeds', () => {
    const rng = mulberry32(2287)
    const totals = new Set<number>()
    for (let n = 0; n < 1000; n++) {
      const s = generateSpecial(randomName(rng))
      for (const k of SPECIAL_KEYS) {
        expect(Number.isInteger(s[k])).toBe(true)
        expect(s[k]).toBeGreaterThanOrEqual(STAT_MIN)
        expect(s[k]).toBeLessThanOrEqual(STAT_MAX)
      }
      const t = specialTotal(s)
      expect(t).toBeGreaterThanOrEqual(TOTAL_MIN)
      expect(t).toBeLessThanOrEqual(TOTAL_MAX)
      totals.add(t)
    }
    expect(totals.size).toBeGreaterThan(8) // totals actually vary
  })

  it('is deterministic per name (trimmed, case-insensitive)', () => {
    expect(generateSpecial('vault dweller')).toEqual(generateSpecial('  VAULT DWELLER '))
    expect(generateSpecial('Alpha')).not.toEqual(generateSpecial('Beta'))
  })

  it('handles an empty name', () => {
    expect(specialTotal(generateSpecial(''))).toBeGreaterThanOrEqual(TOTAL_MIN)
  })
})
