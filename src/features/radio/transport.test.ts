import { describe, expect, it } from 'vitest'
import { clamp, formatHMS, liveOffset, msOfDay, positionAt, progress, seekForKey, seekText, skipBy } from './transport'

const H = 3_600_000
const TRACK = 2 * H + 35 * 60_000 + 4_000 // 2:35:04

describe('formatHMS', () => {
  it('uses m:ss under an hour', () => {
    expect(formatHMS(0)).toBe('0:00')
    expect(formatHMS(65_999)).toBe('1:05')
  })
  it('uses h:mm:ss past an hour or when the total is long', () => {
    expect(formatHMS(TRACK)).toBe('2:35:04')
    expect(formatHMS(133_000, TRACK)).toBe('0:02:13')
    expect(formatHMS(H + 2 * 60_000 + 13_000)).toBe('1:02:13')
  })
  it('treats junk as zero', () => {
    expect(formatHMS(-5)).toBe('0:00')
    expect(formatHMS(NaN)).toBe('0:00')
  })
})

describe('seekText', () => {
  it('reads elapsed of total', () => {
    expect(seekText(H + 2 * 60_000 + 13_000, TRACK)).toBe('1:02:13 of 2:35:04')
    expect(seekText(0, 0)).toBe('Unknown length')
  })
})

describe('liveOffset', () => {
  it('wraps the time of day into the track', () => {
    expect(liveOffset(H, TRACK)).toBe(H)
    expect(liveOffset(3 * H, TRACK)).toBe(3 * H - TRACK)
    expect(liveOffset(TRACK * 4 + 1234, TRACK)).toBe(1234)
  })
  it('stays inside the track and handles bad input', () => {
    for (let t = 0; t < 86_400_000; t += 3_333_333) {
      const v = liveOffset(t, TRACK)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(TRACK)
    }
    expect(liveOffset(5000, 0)).toBe(0)
    expect(liveOffset(-1000, 10_000)).toBe(9000)
  })
  it('msOfDay counts from local midnight', () => {
    expect(msOfDay(new Date(2026, 0, 1, 1, 2, 3, 4))).toBe(H + 2 * 60_000 + 3_000 + 4)
  })
})

describe('seek math', () => {
  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(NaN, 0, 3)).toBe(0)
  })
  it('skips inside the track', () => {
    expect(skipBy(10_000, -30_000, TRACK)).toBe(0)
    expect(skipBy(TRACK - 5000, 30_000, TRACK)).toBe(TRACK)
    expect(skipBy(60_000, 30_000, TRACK)).toBe(90_000)
  })
  it('progress is 0-1', () => {
    expect(progress(TRACK / 2, TRACK)).toBe(0.5)
    expect(progress(5, 0)).toBe(0)
    expect(progress(TRACK * 2, TRACK)).toBe(1)
  })
  it('maps pointer x to a position', () => {
    expect(positionAt(150, 100, 200, 1000)).toBe(250)
    expect(positionAt(50, 100, 200, 1000)).toBe(0)
    expect(positionAt(999, 100, 200, 1000)).toBe(1000)
    expect(positionAt(150, 100, 0, 1000)).toBe(0)
  })
  it('maps slider keys', () => {
    expect(seekForKey('ArrowRight', 0, TRACK)).toBe(10_000)
    expect(seekForKey('ArrowDown', 5000, TRACK)).toBe(0)
    expect(seekForKey('PageUp', 0, TRACK)).toBe(60_000)
    expect(seekForKey('Home', 50_000, TRACK)).toBe(0)
    expect(seekForKey('End', 0, TRACK)).toBe(TRACK - 1000)
    expect(seekForKey('a', 0, TRACK)).toBeNull()
  })
})
