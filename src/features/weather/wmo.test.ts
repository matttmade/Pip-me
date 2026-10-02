import { describe, expect, it } from 'vitest'
import { UNKNOWN_WEATHER, wmoToLabel } from './wmo'

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
