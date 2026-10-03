import { describe, expect, it } from 'vitest'
import { evaluate } from './calc'
import { CATEGORIES, convert, fmtNum } from './convert'

describe('convert', () => {
  it('converts linear units', () => {
    expect(convert(1, 'length', 'mi', 'km')).toBeCloseTo(1.609344)
    expect(convert(12, 'length', 'in', 'ft')).toBeCloseTo(1)
    expect(convert(1, 'mass', 'kg', 'lb')).toBeCloseTo(2.20462, 4)
    expect(convert(1, 'volume', 'gal', 'l')).toBeCloseTo(3.785411784)
    expect(convert(100, 'speed', 'kmh', 'mph')).toBeCloseTo(62.1371, 3)
    expect(convert(1, 'data', 'gb', 'mb')).toBe(1000)
  })
  it('converts temperature', () => {
    expect(convert(212, 'temp', 'F', 'C')).toBeCloseTo(100)
    expect(convert(-40, 'temp', 'C', 'F')).toBeCloseTo(-40)
    expect(convert(0, 'temp', 'K', 'C')).toBeCloseTo(-273.15)
  })
  it('round-trips every unit pair', () => {
    for (const c of CATEGORIES)
      for (const a of c.units) for (const b of c.units) expect(convert(convert(7, c.id, a.id, b.id), c.id, b.id, a.id)).toBeCloseTo(7, 6)
  })
  it('defaults hold valid units', () => {
    for (const c of CATEGORIES) expect(c.units.map((u) => u.id)).toEqual(expect.arrayContaining([c.from, c.to]))
  })
  it('returns NaN for unknown units', () => {
    expect(convert(1, 'length', 'parsec', 'km')).toBeNaN()
  })
})

describe('fmtNum', () => {
  it('trims float noise', () => {
    expect(fmtNum(0.1 + 0.2)).toBe('0.3')
    expect(fmtNum(1.609344)).toBe('1.60934')
    expect(fmtNum(1234567)).toBe('1234567')
    expect(fmtNum(0)).toBe('0')
    expect(fmtNum(2e15)).toBe('2E+15')
    expect(fmtNum(NaN)).toBe('ERR')
  })
})

describe('evaluate', () => {
  it('respects precedence and parentheses', () => {
    expect(evaluate('1 + 2 * 3')).toBe(7)
    expect(evaluate('(1 + 2) * 3')).toBe(9)
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512)
    expect(evaluate('-2 ^ 2')).toBe(-4)
    expect(evaluate('2 ^ -1')).toBe(0.5)
    expect(evaluate('10 % 4')).toBe(2)
    expect(evaluate('7 ÷ 2 × 4')).toBe(14)
    expect(evaluate('1,5 + 1')).toBe(2.5)
    expect(evaluate('2pi')).toBeNull()
    expect(evaluate('2*pi')).toBeCloseTo(Math.PI * 2)
    expect(evaluate('.5 + 1e3')).toBe(1000.5)
  })
  it('rejects junk', () => {
    expect(evaluate('')).toBeNull()
    expect(evaluate('1 +')).toBeNull()
    expect(evaluate('(1')).toBeNull()
    expect(evaluate('1/0')).toBeNull()
    expect(evaluate('alert(1)')).toBeNull()
  })
})
