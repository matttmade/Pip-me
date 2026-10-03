import { describe, expect, it } from 'vitest'
import { MAX_EFFECTS, questsDoneToday, statusEffects, type EffectsInput } from './statusEffects'

const base: EffectsInput = {
  hour: 11,
  weather: null,
  battery: { level: 1, charging: false },
  radio: { playing: false, station: null },
  questsToday: 0,
  streak: 0,
  daylight: { remaining: 0, total: 0 },
}
const ids = (s: Partial<EffectsInput>, max?: number) => statusEffects({ ...base, ...s }, max).map((e) => e.id)
const wx = (w: Partial<NonNullable<EffectsInput['weather']>>) => ({ code: 2, temp: 65, uv: 2, isDay: true, units: 'F' as const, ...w })

describe('statusEffects', () => {
  it('is empty on a quiet mid-morning with no data', () => {
    expect(ids({})).toEqual([])
  })

  it('reads the clock', () => {
    expect(ids({ hour: 23 })).toEqual(['night-owl'])
    expect(ids({ hour: 2 })).toEqual(['night-owl'])
    expect(ids({ hour: 6 })).toEqual(['early'])
    expect(ids({ hour: 14 })).toEqual(['slump'])
  })

  it('reads battery: charging beats low power', () => {
    expect(ids({ battery: { level: 0.1, charging: false } })).toEqual(['low-power'])
    expect(statusEffects({ ...base, battery: { level: 0.1, charging: false } })[0]).toMatchObject({ mod: '-2 AGI', note: 'Battery at 10%', tone: 'debuff' })
    expect(ids({ battery: { level: 0.1, charging: true } })).toEqual(['charging'])
    expect(ids({ battery: { level: 0.5, charging: false } })).toEqual([])
  })

  it('reads weather conditions, temperature and UV', () => {
    expect(ids({ weather: wx({ code: 3 }) })).toEqual(['overcast'])
    expect(ids({ weather: wx({ code: 63 }) })).toEqual(['rain'])
    expect(ids({ weather: wx({ code: 95 }) })).toEqual(['storm'])
    expect(ids({ weather: wx({ code: 0, isDay: false }) })).toEqual([])
    expect(ids({ weather: wx({ code: 0 }) })).toEqual(['clear'])
    expect(ids({ weather: wx({ temp: 95 }) })).toEqual(['heat'])
    expect(ids({ weather: wx({ temp: -3, units: 'C' }) })).toEqual(['freeze'])
    expect(ids({ weather: wx({ temp: 35, units: 'C' }) })).toEqual(['heat'])
    expect(ids({ weather: wx({ uv: 8 }) })).toEqual(['rads'])
  })

  it('reads radio, quests, streak and daylight', () => {
    const fx = statusEffects({ ...base, radio: { playing: true, station: 'DIAMOND CITY' } })
    expect(fx).toEqual([expect.objectContaining({ id: 'radio', note: 'DIAMOND CITY', mod: '+1 CHA' })])
    expect(statusEffects({ ...base, questsToday: 5 })[0]).toMatchObject({ mod: '+3 INT', note: '5 quests done today' })
    expect(statusEffects({ ...base, questsToday: 1 })[0].note).toBe('1 quest done today')
    expect(ids({ streak: 1 })).toEqual([])
    expect(ids({ streak: 4 })).toEqual(['streak'])
    expect(ids({ daylight: { remaining: 30, total: 600 } })).toEqual(['golden'])
    expect(ids({ daylight: { remaining: 200, total: 600 } })).toEqual([])
  })

  it('puts pressing things first and caps the list', () => {
    const all: Partial<EffectsInput> = {
      hour: 23,
      battery: { level: 0.05, charging: false },
      weather: wx({ code: 63, temp: 99, uv: 9 }),
      radio: { playing: true, station: null },
      questsToday: 2,
      streak: 3,
    }
    expect(ids(all)).toHaveLength(MAX_EFFECTS)
    expect(ids(all)[0]).toBe('low-power')
    expect(ids(all, 99)).toEqual(['low-power', 'rain', 'heat', 'rads', 'radio', 'quests', 'streak', 'night-owl'])
    expect(ids(all, 0)).toEqual([])
  })
})

describe('questsDoneToday', () => {
  it('counts completions since local midnight', () => {
    const now = new Date(2026, 9, 3, 15, 0)
    const today = new Date(2026, 9, 3, 9, 0).getTime()
    const yesterday = new Date(2026, 9, 2, 23, 0).getTime()
    expect(questsDoneToday([{ completedAt: today }, { completedAt: yesterday }, {}, { completedAt: today + 1 }], now)).toBe(2)
    expect(questsDoneToday([], now)).toBe(0)
  })
})
