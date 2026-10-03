import { describe, expect, it } from 'vitest'
import { compassPoint, formatCountdown, formatDuration, goldenHour, moonPath, moonPhase, nextPhases, nextSunEvent } from './sky'

describe('moonPhase', () => {
  it('is new at a known new moon and full at a known full moon', () => {
    const nm = moonPhase(Date.UTC(2024, 0, 11, 11, 57))
    expect(Math.min(nm.fraction, 1 - nm.fraction)).toBeLessThan(0.01)
    expect(nm.name).toBe('NEW MOON')
    expect(nm.illumination).toBeLessThan(0.01)
    const fm = moonPhase(Date.UTC(2024, 0, 25, 17, 54))
    expect(fm.fraction).toBeCloseTo(0.5, 1)
    expect(fm.name).toBe('FULL MOON')
    expect(fm.illumination).toBeGreaterThan(0.99)
    expect(fm.daysToFull).toBe(0)
  })
  it('names the quarters', () => {
    expect(moonPhase(Date.UTC(2024, 0, 18, 3, 53)).name).toBe('FIRST QUARTER')
    expect(moonPhase(Date.UTC(2024, 1, 2, 23, 18)).name).toBe('LAST QUARTER')
    expect(moonPhase(Date.UTC(2024, 0, 14)).name).toBe('WAXING CRESCENT')
    expect(moonPhase(Date.UTC(2024, 0, 29)).name).toBe('WANING GIBBOUS')
  })
  it('handles dates before the reference', () => {
    const p = moonPhase(Date.UTC(1969, 6, 20))
    expect(p.fraction).toBeGreaterThanOrEqual(0)
    expect(p.fraction).toBeLessThan(1)
  })
})

describe('nextPhases', () => {
  it('lists the four principal phases ahead, soonest first', () => {
    // Just after the 2024-01-11 new moon: first quarter ~Jan 18, full ~Jan 25, last ~Feb 2, new ~Feb 9.
    const p = nextPhases(Date.UTC(2024, 0, 12))
    expect(p.map((x) => x.name)).toEqual(['FIRST Q', 'FULL', 'LAST Q', 'NEW'])
    // A mean-motion model: within a day of the true times.
    expect(Math.abs(p[1].at - Date.UTC(2024, 0, 25, 17, 54))).toBeLessThan(86_400_000)
    expect(Math.abs(p[3].at - Date.UTC(2024, 1, 9, 22, 59))).toBeLessThan(86_400_000)
  })
})

describe('moonPath', () => {
  it('draws nothing at new moon and a full disc at full moon', () => {
    expect(moonPath(0, 10)).toBe('')
    expect(moonPath(0.5, 10)).toBe('M0 -10A10 10 0 0 1 0 10A10 10 0 0 1 0 -10Z')
  })
  it('lights the right limb when waxing and the left when waning', () => {
    expect(moonPath(0.125, 10)).toMatch(/^M0 -10A10 10 0 0 1 0 10A7\.071 10 0 0 0 0 -10Z$/)
    expect(moonPath(0.875, 10)).toMatch(/^M0 -10A10 10 0 0 0 0 10A7\.071 10 0 0 1 0 -10Z$/)
    expect(moonPath(0.25, 10)).toContain('A0 10')
  })
})

describe('nextSunEvent / formatCountdown', () => {
  const rise = Date.UTC(2026, 9, 2, 10, 0)
  const set = Date.UTC(2026, 9, 2, 22, 0)
  const next = Date.UTC(2026, 9, 3, 10, 1)
  it('picks sunrise, then sunset, then tomorrow', () => {
    expect(nextSunEvent(rise - 60_000, { sunrise: rise, sunset: set })).toEqual({ kind: 'SUNRISE', at: rise, ms: 60_000 })
    expect(nextSunEvent(set - 8_040_000, { sunrise: rise, sunset: set })?.kind).toBe('SUNSET')
    expect(nextSunEvent(set + 1, { sunrise: rise, sunset: set, sunriseNext: next })?.at).toBe(next)
    expect(nextSunEvent(set + 1, { sunrise: rise, sunset: set })?.at).toBe(rise + 86_400_000)
    expect(nextSunEvent(0, { sunrise: null, sunset: set })).toBeNull()
  })
  it('formats countdowns', () => {
    expect(formatCountdown(8_040_000)).toBe('2H 14M')
    expect(formatCountdown(7_260_000)).toBe('2H 01M')
    expect(formatCountdown(14 * 60_000 + 59_000)).toBe('14M')
    expect(formatCountdown(30_000)).toBe('<1M')
  })
  it('formats ticking durations', () => {
    expect(formatDuration(3_725_000)).toBe('1:02:05')
    expect(formatDuration(125_400)).toBe('02:05')
    expect(formatDuration(-5)).toBe('00:00')
  })
})

describe('goldenHour', () => {
  const rise = Date.UTC(2026, 9, 2, 10, 0)
  const set = Date.UTC(2026, 9, 2, 22, 0)
  it('marks the hour after sunrise and before sunset', () => {
    expect(goldenHour(rise + 30 * 60_000, rise, set)?.active).toBe('MORNING')
    expect(goldenHour(set - 30 * 60_000, rise, set)?.active).toBe('EVENING')
    expect(goldenHour(rise + 5 * 3_600_000, rise, set)?.active).toBeNull()
    expect(goldenHour(rise, rise, set)?.evening.start).toBe(set - 3_600_000)
    expect(goldenHour(rise, null, set)).toBeNull()
  })
})

describe('compassPoint', () => {
  it('rounds to 16 points', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(359)).toBe('N')
    expect(compassPoint(225)).toBe('SW')
    expect(compassPoint(100)).toBe('E')
    expect(compassPoint(-90)).toBe('W')
    expect(compassPoint(200)).toBe('SSW')
  })
})
