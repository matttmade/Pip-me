import { describe, expect, it } from 'vitest'
import {
  completeFocus,
  countdown,
  finishCountdown,
  fmtCountdown,
  fmtStopwatch,
  isDue,
  lapDurations,
  lapStopwatch,
  MIN,
  newFocus,
  newStopwatch,
  parseDuration,
  pauseCountdown,
  pauseStopwatch,
  progressOf,
  remainingOf,
  setFocusLength,
  startCountdown,
  startStopwatch,
  statusOf,
  switchFocusPhase,
} from './timer'

describe('countdown', () => {
  it('runs, pauses, resumes and finishes', () => {
    let c = countdown(10_000)
    expect(statusOf(c, 0)).toBe('idle')
    c = startCountdown(c, 1000)
    expect(statusOf(c, 2000)).toBe('running')
    expect(remainingOf(c, 4000)).toBe(7000)
    c = pauseCountdown(c, 4000)
    expect(statusOf(c, 99_000)).toBe('paused')
    expect(remainingOf(c, 99_000)).toBe(7000)
    c = startCountdown(c, 100_000)
    expect(remainingOf(c, 103_000)).toBe(4000)
    expect(isDue(c, 106_999)).toBe(false)
    expect(isDue(c, 107_000)).toBe(true)
    expect(statusOf(c, 107_000)).toBe('done')
    expect(progressOf(c, 105_000)).toBeCloseTo(0.8)
    c = finishCountdown(c)
    expect(isDue(c, 200_000)).toBe(false)
    expect(statusOf(c, 200_000)).toBe('done')
  })

  it('restarts from full when started after finishing', () => {
    const c = startCountdown(finishCountdown(countdown(5000)), 0)
    expect(remainingOf(c, 1000)).toBe(4000)
  })

  it('start is idempotent while running', () => {
    const c = startCountdown(countdown(5000), 0)
    expect(startCountdown(c, 3000)).toBe(c)
  })
})

describe('focus stim', () => {
  it('alternates focus and break, counting finished focus sessions', () => {
    let f = newFocus(25, 5)
    expect(f.timer.duration).toBe(25 * MIN)
    f = completeFocus(f)
    expect(f).toMatchObject({ phase: 'break', sessions: 1 })
    expect(f.timer.duration).toBe(5 * MIN)
    f = completeFocus(f)
    expect(f).toMatchObject({ phase: 'focus', sessions: 1 })
  })

  it('skipping a phase does not count a session', () => {
    expect(switchFocusPhase(newFocus(25, 5))).toMatchObject({ phase: 'break', sessions: 0, timer: { duration: 5 * MIN } })
  })

  it('length changes only reload an idle timer of that phase', () => {
    const f = setFocusLength(newFocus(25, 5), 'focus', 50, 0)
    expect(f.timer.duration).toBe(50 * MIN)
    const running = { ...f, timer: startCountdown(f.timer, 0) }
    expect(setFocusLength(running, 'focus', 10, 1000).timer.duration).toBe(50 * MIN)
    expect(setFocusLength(f, 'break', 10, 0)).toMatchObject({ breakMin: 10, timer: { duration: 50 * MIN } })
  })
})

describe('stopwatch', () => {
  it('accumulates across pauses and records laps', () => {
    let s = startStopwatch(newStopwatch(), 0)
    s = lapStopwatch(s, 1500)
    s = pauseStopwatch(s, 2000)
    s = lapStopwatch(s, 5000) // ignored while paused
    s = startStopwatch(s, 10_000)
    s = lapStopwatch(s, 13_000)
    expect(s.laps).toEqual([1500, 5000])
    expect(lapDurations(s.laps)).toEqual([1500, 3500])
  })
})

describe('formatting', () => {
  it('formats countdowns rounding up', () => {
    expect(fmtCountdown(0)).toBe('00:00')
    expect(fmtCountdown(1)).toBe('00:01')
    expect(fmtCountdown(25 * MIN)).toBe('25:00')
    expect(fmtCountdown(3600_000 + 61_000)).toBe('1:01:01')
  })
  it('formats stopwatch hundredths', () => {
    expect(fmtStopwatch(61_234)).toBe('01:01.23')
    expect(fmtStopwatch(3_600_000)).toBe('1:00:00.00')
  })
  it('parses durations', () => {
    expect(parseDuration('3')).toBe(3000)
    expect(parseDuration('1:30')).toBe(90_000)
    expect(parseDuration('1:00:00')).toBe(3_600_000)
    expect(parseDuration('5m')).toBe(5 * MIN)
    expect(parseDuration('1.5h')).toBe(5_400_000)
    expect(parseDuration('1:75')).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('25h')).toBeNull()
  })
})
