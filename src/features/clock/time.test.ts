import { describe, expect, it } from 'vitest'
import { clockParts, daylight, formatDate, formatMinutes, wastelandDate } from './time'

describe('wastelandDate', () => {
  it('adds 261 years: 2026 → 2287', () => {
    expect(wastelandDate(new Date(2026, 9, 2))).toBe('OCT 02, 2287')
    expect(wastelandDate(new Date(2025, 0, 31))).toBe('JAN 31, 2286')
  })
  it('handles leap days', () => {
    expect(wastelandDate(new Date(2024, 1, 29))).toBe('FEB 29, 2285')
  })
})

describe('formatDate / clockParts', () => {
  it('formats the real date', () => {
    expect(formatDate(new Date(2026, 11, 5))).toBe('DEC 05, 2026')
  })
  it('splits a 12-hour clock', () => {
    expect(clockParts(new Date(2026, 0, 1, 0, 7, 9))).toEqual({ hm: '12:07', ampm: 'AM', seconds: '09' })
    expect(clockParts(new Date(2026, 0, 1, 13, 30, 0))).toEqual({ hm: '01:30', ampm: 'PM', seconds: '00' })
  })
})

describe('daylight', () => {
  const rise = Date.UTC(2026, 9, 2, 10, 0)
  const set = Date.UTC(2026, 9, 2, 22, 0) // 12 h
  const at = (h: number) => Date.UTC(2026, 9, 2, h, 0)
  it('counts minutes left in the day', () => {
    expect(daylight(at(16), rise, set)).toEqual({ remaining: 360, total: 720, progress: 0.5, isDay: true })
  })
  it('is full before sunrise and empty after sunset', () => {
    expect(daylight(at(5), rise, set)).toMatchObject({ remaining: 720, progress: 0, isDay: false })
    expect(daylight(at(23), rise, set)).toMatchObject({ remaining: 0, progress: 1, isDay: false })
  })
  it('returns zeros when sun times are unknown', () => {
    expect(daylight(at(12), null, set)).toMatchObject({ remaining: 0, total: 0 })
  })
})

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(250)).toBe('4H 10M')
    expect(formatMinutes(42)).toBe('42M')
  })
})
