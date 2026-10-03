import { describe, expect, it } from 'vitest'
import {
  blastPhaseAt,
  blastTimeline,
  confirmLeft,
  CONFIRM_MS,
  cycleWeapon,
  DEFAULT_WEAPON,
  normalizeWeapon,
  pressNuke,
  RELOAD_MS,
  settle,
  squirt,
  weaponById,
  type WeaponState,
} from './weapons'

const water = (ammo = 24): WeaponState => ({ ...DEFAULT_WEAPON, id: 'water', ammo })

describe('weapon cycle', () => {
  it('goes FIST → WATER → NUKE → FIST', () => {
    const a = cycleWeapon(DEFAULT_WEAPON)
    const b = cycleWeapon(a)
    expect([a.id, b.id, cycleWeapon(b).id]).toEqual(['water', 'nuke', 'fist'])
  })
  it('drops a pending launch confirm when swapping', () => {
    expect(cycleWeapon({ ...DEFAULT_WEAPON, id: 'nuke', confirmUntil: 5 }).confirmUntil).toBeNull()
  })
  it('looks weapons up by id', () => {
    expect(weaponById('water').mag).toBe(24)
    expect(weaponById('fist').dmg).toBe(2)
  })
})

describe('normalizeWeapon', () => {
  it('repairs junk and clamps ammo', () => {
    expect(normalizeWeapon(null)).toEqual(DEFAULT_WEAPON)
    expect(normalizeWeapon({ id: 'laser', ammo: 99 })).toEqual({ ...DEFAULT_WEAPON, ammo: 24 })
    expect(normalizeWeapon({ id: 'water', ammo: -3 }).ammo).toBe(0)
  })
  it('never restores an armed nuke', () => {
    expect(normalizeWeapon({ id: 'nuke', ammo: 5, confirmUntil: 1e15 }).confirmUntil).toBeNull()
  })
})

describe('water pistol', () => {
  it('spends one round per squirt', () => {
    const { state, shot } = squirt(water(), 0)
    expect(shot).toBe('squirt')
    expect(state.ammo).toBe(23)
    expect(state.reloadAt).toBeNull()
  })
  it('starts a refill on the last round and is dry until it lands', () => {
    const last = squirt(water(1), 1000)
    expect(last.state.ammo).toBe(0)
    expect(last.state.reloadAt).toBe(1000 + RELOAD_MS)
    expect(squirt(last.state, 1200).shot).toBe('dry')
    const after = squirt(last.state, 1000 + RELOAD_MS)
    expect(after.shot).toBe('squirt')
    expect(after.state.ammo).toBe(23)
  })
  it('an empty tank with no refill pending starts one', () => {
    const r = squirt(water(0), 50)
    expect(r.shot).toBe('dry')
    expect(r.state.reloadAt).toBe(50 + RELOAD_MS)
  })
  it('settle refills once the time is up and is a no-op otherwise', () => {
    const s = { ...water(0), reloadAt: 100 }
    expect(settle(s, 99)).toBe(s)
    expect(settle(s, 100)).toMatchObject({ ammo: 24, reloadAt: null })
  })
})

describe('nuke', () => {
  const nuke: WeaponState = { ...DEFAULT_WEAPON, id: 'nuke' }
  it('needs two taps inside the window to launch', () => {
    const first = pressNuke(nuke, 0)
    expect(first.result).toBe('arm')
    expect(confirmLeft(first.state, 0)).toBe(3)
    expect(confirmLeft(first.state, 2500)).toBe(1)
    expect(pressNuke(first.state, CONFIRM_MS - 1).result).toBe('launch')
  })
  it('a late second tap only re-arms', () => {
    const first = pressNuke(nuke, 0)
    expect(pressNuke(first.state, CONFIRM_MS).result).toBe('arm')
  })
  it('stands down to FIST when the window closes', () => {
    const armed = pressNuke(nuke, 0).state
    expect(settle(armed, CONFIRM_MS - 1).id).toBe('nuke')
    expect(settle(armed, CONFIRM_MS)).toMatchObject({ id: 'fist', confirmUntil: null })
  })
})

describe('blast timeline', () => {
  it('runs flash → cloud → melt → lost → reboot in order', () => {
    const tl = blastTimeline(false)
    expect(tl.map((c) => c.phase)).toEqual(['flash', 'cloud', 'melt', 'lost', 'reboot'])
    expect(tl.every((c, i) => i === 0 || c.at > tl[i - 1].at)).toBe(true)
    const end = tl[tl.length - 1].at
    expect(end).toBeGreaterThanOrEqual(2500)
    expect(end).toBeLessThanOrEqual(3500)
  })
  it('reduced motion skips straight to the reboot notice', () => {
    const tl = blastTimeline(true)
    expect(tl.map((c) => c.phase)).toEqual(['lost', 'reboot'])
  })
  it('blastPhaseAt picks the latest cue reached', () => {
    const tl = blastTimeline(false)
    expect(blastPhaseAt(tl, 0)).toBe('flash')
    expect(blastPhaseAt(tl, 300)).toBe('cloud')
    expect(blastPhaseAt(tl, 2600)).toBe('lost')
    expect(blastPhaseAt(tl, 99999)).toBe('reboot')
  })
})
