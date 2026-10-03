import { afterEach, describe, expect, it } from 'vitest'
import { emit } from '../../lib/events'
import { readStored, resetAll } from '../../lib/store'
import { applyPerkEvent, GLITCH_GOAL, NO_PERKS, NO_PROGRESS, PERKS, PERKS_KEY, startPerkTracking, stopPerkTracking } from './perks'

describe('applyPerkEvent', () => {
  it('grants one-shot perks once', () => {
    const a = applyPerkEvent(NO_PERKS, NO_PROGRESS, { type: 'figure-tapped' })
    expect(a.newly).toEqual(['say-hello'])
    const b = applyPerkEvent(a.earned, a.progress, { type: 'figure-tapped' })
    expect(b.newly).toEqual([])
    expect(b.earned).toBe(a.earned)
  })

  it('level 2, hacks and holotapes have conditions', () => {
    expect(applyPerkEvent([], NO_PROGRESS, { type: 'level-up', level: 1 }).newly).toEqual([])
    expect(applyPerkEvent([], NO_PROGRESS, { type: 'level-up', level: 2 }).newly).toEqual(['moving-up'])
    expect(applyPerkEvent([], NO_PROGRESS, { type: 'hack-result', success: false, daily: true }).newly).toEqual([])
    expect(applyPerkEvent([], NO_PROGRESS, { type: 'hack-result', success: true, daily: true }).newly).toEqual(['skeleton-key', 'daily-grind'])
    expect(applyPerkEvent([], NO_PROGRESS, { type: 'holotape-import', count: 0 }).newly).toEqual([])
  })

  it(`counts ${GLITCH_GOAL} glitches`, () => {
    let s = { earned: NO_PERKS, progress: NO_PROGRESS, newly: [] as string[] }
    for (let i = 0; i < GLITCH_GOAL; i++) {
      expect(s.newly).toEqual([])
      s = applyPerkEvent(s.earned, s.progress, { type: 'glitch', strength: 1 })
    }
    expect(s.newly).toEqual(['static-cling'])
    const after = applyPerkEvent(s.earned, s.progress, { type: 'glitch', strength: 1 })
    expect(after.progress).toBe(s.progress) // stops counting once earned
  })

  it('tourist needs every non-landing tab', () => {
    let s = { earned: NO_PERKS, progress: NO_PROGRESS, newly: [] as string[] }
    for (const tab of ['INV', 'DATA', 'MAP', 'MAP']) s = applyPerkEvent(s.earned, s.progress, { type: 'tab-change', tab })
    expect(s.earned).toEqual([])
    s = applyPerkEvent(s.earned, s.progress, { type: 'tab-change', tab: 'RADIO' })
    expect(s.newly).toEqual(['tourist'])
  })

  it('ignores noise events without allocating', () => {
    const r = applyPerkEvent(NO_PERKS, NO_PROGRESS, { type: 'list-move' })
    expect(r.earned).toBe(NO_PERKS)
    expect(r.progress).toBe(NO_PROGRESS)
  })

  it('every perk id is unique', () => {
    expect(new Set(PERKS.map((p) => p.id)).size).toBe(PERKS.length)
  })
})

describe('startPerkTracking', () => {
  afterEach(() => {
    stopPerkTracking()
    resetAll()
  })

  it('is idempotent and persists earned perks', () => {
    startPerkTracking()
    startPerkTracking()
    emit({ type: 'radio-tuned', station: 'X' })
    expect(readStored(PERKS_KEY, NO_PERKS)).toEqual(['on-the-air'])
  })
})
