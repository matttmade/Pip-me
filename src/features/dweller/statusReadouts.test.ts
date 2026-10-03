import { describe, expect, it } from 'vitest'
import { navTo, radsWord, readouts } from './statusReadouts'

describe('readouts', () => {
  it('formats live data', () => {
    const r = readouts({ weather: { temp: 72, uv: 6.6, units: 'F' }, weatherStatus: 'ok', caps: 3, activeQuests: 2 })
    expect(r.map((b) => [b.id, b.value, b.sub, b.dim])).toEqual([
      ['temp', '72°F', 'OUTSIDE', false],
      ['rads', '7', 'HIGH', false],
      ['caps', '3', 'DAY STREAK', false],
      ['quests', '2', 'ACTIVE', false],
    ])
  })

  it('shows an intentional offline / empty state', () => {
    const r = readouts({ weather: null, weatherStatus: 'error', caps: 0, activeQuests: 0 })
    expect(r.map((b) => [b.value, b.sub, b.dim])).toEqual([
      ['--', 'NO SIGNAL', true],
      ['--', 'NO SIGNAL', true],
      ['0', 'HACK TODAY', false],
      ['0', 'ALL CLEAR', true],
    ])
    expect(readouts({ weather: null, weatherStatus: 'loading', caps: 0, activeQuests: 0 })[0].sub).toBe('SCANNING')
  })

  it('names UV severity', () => {
    expect([0, 3, 6, 8, 11].map(radsWord)).toEqual(['LOW', 'MODERATE', 'HIGH', 'V.HIGH', 'EXTREME'])
  })
})

describe('navTo', () => {
  it('selects a tab and its sub-tab, keeping the others', () => {
    expect(navTo({ tab: 0, subs: [0, 1, 2, 0, 0] }, 2, 1)).toEqual({ tab: 2, subs: [0, 1, 1, 0, 0] })
  })
  it('repairs a malformed stored value', () => {
    expect(navTo(null, 2, 0)).toEqual({ tab: 2, subs: [0, 0, 0] })
    expect(navTo({ subs: ['x', 1] }, 2, 1)).toEqual({ tab: 2, subs: [0, 1, 1] })
  })
})
