import { describe, expect, it } from 'vitest'
import { aidWgVal, carryCapacity, fmtWg, holotapeWgVal, noteWgVal, totals } from './weight'

describe('inventory weight and value', () => {
  it('is deterministic per item', () => {
    const a = holotapeWgVal({ url: 'https://example.com/' })
    expect(holotapeWgVal({ url: 'https://example.com/' })).toEqual(a)
    expect(a.wg).toBe(0.1)
    expect(a.val).toBeGreaterThanOrEqual(2)
    expect(a.val).toBeLessThanOrEqual(10)
    expect(holotapeWgVal({ url: 'https://example.com/', uses: 3 }).val).toBe(a.val + 3)
  })

  it('values aid by use and notes by length', () => {
    expect(aidWgVal({ uses: 0 })).toEqual({ wg: 0.5, val: 10 })
    expect(aidWgVal({ uses: 4 }).val).toBe(18)
    expect(noteWgVal({ body: '' })).toEqual({ wg: 0, val: 1 })
    expect(noteWgVal({ body: 'word '.repeat(51) }).val).toBe(3)
  })

  it('totals without float drift', () => {
    const ten = Array.from({ length: 10 }, () => ({ wg: 0.1, val: 1 }))
    expect(totals(ten)).toEqual({ wg: 1, val: 10 })
    expect(totals([])).toEqual({ wg: 0, val: 0 })
  })

  it('formats weight and carry capacity', () => {
    expect(fmtWg(0.1)).toBe('0.1')
    expect(fmtWg(2)).toBe('2')
    expect(fmtWg(0.30000000000000004)).toBe('0.3')
    expect(carryCapacity(5)).toBe(250)
  })
})
