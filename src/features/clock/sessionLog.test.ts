import { describe, expect, it } from 'vitest'
import {
  bootSession,
  dayKey,
  EMPTY_SESSION,
  listeningMs,
  questsToday,
  radioTick,
  reduceSession,
  uptimeMs,
  xpToday,
  type SessionLog,
} from './sessionLog'

const T = new Date(2026, 9, 3, 12, 0).getTime()

describe('reduceSession', () => {
  it('counts tabs, switches and glitches', () => {
    let s: SessionLog = EMPTY_SESSION
    s = reduceSession(s, { type: 'tab-change', tab: 'MAP' }, T)
    s = reduceSession(s, { type: 'tab-change', tab: 'MAP' }, T)
    s = reduceSession(s, { type: 'subtab-change', sub: 'STATS' }, T)
    s = reduceSession(s, { type: 'glitch', strength: 1 }, T)
    expect(s).toMatchObject({ tabs: ['STAT', 'MAP'], switches: 3, glitches: 1 })
  })
  it('counts quests per local day and resets on a new day', () => {
    let s = reduceSession(EMPTY_SESSION, { type: 'quest-complete', xp: 20 }, T)
    s = reduceSession(s, { type: 'quest-complete', xp: 30 }, T)
    expect(questsToday(s, T)).toBe(2)
    expect(xpToday(s, T)).toBe(50)
    const tomorrow = T + 86_400_000
    expect(questsToday(s, tomorrow)).toBe(0)
    s = reduceSession(s, { type: 'quest-complete', xp: 10 }, tomorrow)
    expect(questsToday(s, tomorrow)).toBe(1)
    expect(xpToday(s, tomorrow)).toBe(10)
  })
  it('counts hacks won and tried, and stations tuned', () => {
    let s = reduceSession(EMPTY_SESSION, { type: 'hack-result', success: false, daily: false }, T)
    s = reduceSession(s, { type: 'hack-result', success: true, daily: true }, T)
    s = reduceSession(s, { type: 'radio-tuned', station: 'X' }, T)
    expect(s).toMatchObject({ hacks: 1, hackTries: 2, tuned: 1 })
  })
  it('ignores other events without copying', () => {
    expect(reduceSession(EMPTY_SESSION, { type: 'list-move' }, T)).toBe(EMPTY_SESSION)
  })
})

describe('radio listening', () => {
  it('accumulates while playing', () => {
    let s = radioTick(EMPTY_SESSION, true, T)
    expect(radioTick(s, true, T + 5)).toBe(s)
    expect(listeningMs(s, T + 60_000)).toBe(60_000)
    s = radioTick(s, false, T + 90_000)
    expect(s.radioSince).toBeNull()
    expect(listeningMs(s, T + 999_999)).toBe(90_000)
  })
})

describe('bootSession / uptime', () => {
  it('stamps boot once and drops a stale listening stretch', () => {
    const s = bootSession({ ...EMPTY_SESSION, radioSince: T - 5000 }, false, T)
    expect(s).toMatchObject({ bootAt: T, radioSince: null })
    expect(bootSession(s, false, T + 10)).toBe(s)
    expect(uptimeMs(s, T + 65_000)).toBe(65_000)
    expect(uptimeMs(EMPTY_SESSION, T)).toBe(0)
  })
})

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 9, 23, 59).getTime())).toBe('2026-01-09')
  })
})
