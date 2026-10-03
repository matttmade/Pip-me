import { describe, expect, it } from 'vitest'
import { UNKNOWN_WEATHER, wmoGlyph, wmoToLabel } from './wmo'

describe('wmoGlyph', () => {
  it('groups codes into icon shapes', () => {
    expect(wmoGlyph(0)).toBe('clear')
    expect(wmoGlyph(1)).toBe('clear')
    expect(wmoGlyph(2)).toBe('partly')
    expect(wmoGlyph(3)).toBe('cloud')
    expect(wmoGlyph(48)).toBe('fog')
    expect(wmoGlyph(53)).toBe('drizzle')
    expect(wmoGlyph(65)).toBe('rain')
    expect(wmoGlyph(81)).toBe('rain')
    expect(wmoGlyph(73)).toBe('snow')
    expect(wmoGlyph(86)).toBe('snow')
    expect(wmoGlyph(96)).toBe('storm')
    expect(wmoGlyph(4)).toBe('unknown')
    expect(wmoGlyph(null)).toBe('unknown')
  })
})

describe('wmoToLabel', () => {
  it('maps known codes to uppercase labels', () => {
    expect(wmoToLabel(0)).toBe('CLEAR SKIES')
    expect(wmoToLabel(3)).toBe('OVERCAST')
    expect(wmoToLabel(45)).toBe('FOG')
    expect(wmoToLabel(63)).toBe('RAIN')
    expect(wmoToLabel(75)).toBe('HEAVY SNOW')
    expect(wmoToLabel(95)).toBe('THUNDERSTORM')
    expect(wmoToLabel(99)).toBe('THUNDERSTORM + HAIL')
  })
  it('every label is uppercase', () => {
    for (let c = 0; c < 100; c++) expect(wmoToLabel(c)).toBe(wmoToLabel(c).toUpperCase())
  })
  it('falls back for unknown codes', () => {
    expect(wmoToLabel(4)).toBe(UNKNOWN_WEATHER)
    expect(wmoToLabel(-1)).toBe(UNKNOWN_WEATHER)
    expect(wmoToLabel(undefined)).toBe(UNKNOWN_WEATHER)
    expect(wmoToLabel(null)).toBe(UNKNOWN_WEATHER)
  })
})
