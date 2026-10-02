import { beforeEach, expect, test } from 'vitest'
import { DEFAULT_EFFECTS } from '../effects/presets'
import { readStored, resetAll, writeStored } from './store'
import {
  applySnapshot,
  captureSnapshot,
  decodePreset,
  encodePreset,
  makePreset,
  nextPresetName,
  normalizeSnapshot,
  sameSnapshot,
} from './systemPresets'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  resetAll()
})

test('capture reflects live settings, apply restores them', () => {
  writeStored('effects', { ...DEFAULT_EFFECTS, hue: 38, preset: 'CUSTOM' })
  writeStored('settings', { units: 'C', wastelandDate: false, sound: false, volume: 0.2 })
  writeStored('dweller:detail', 'HI-FI')
  const snap = captureSnapshot()
  expect(snap.effects.hue).toBe(38)
  expect(snap.settings.units).toBe('C')
  expect(snap.dweller?.detail).toBe('HI-FI')

  writeStored('effects', DEFAULT_EFFECTS)
  writeStored('settings', { units: 'F', wastelandDate: true, sound: true, volume: 0.5 })
  writeStored('dweller:detail', 'RETRO')
  applySnapshot(snap)
  expect(readStored<{ hue: number }>('effects', DEFAULT_EFFECTS).hue).toBe(38)
  expect(readStored<{ volume: number }>('settings', { volume: 0 }).volume).toBe(0.2)
  expect(readStored('dweller:detail', '')).toBe('HI-FI')
  expect(sameSnapshot(captureSnapshot(), snap)).toBe(true)
})

test('junk snapshots are repaired, never thrown', () => {
  const s = normalizeSnapshot({ effects: { hue: 200 }, settings: { volume: 9, units: 'K' }, device: 'x' })
  expect(s.effects.hue).toBe(200)
  expect(s.effects.scanlines).toEqual(DEFAULT_EFFECTS.scanlines)
  expect(s.settings.volume).toBe(1)
  expect(s.settings.units).toBe('F')
  expect(normalizeSnapshot(null).effects).toEqual(DEFAULT_EFFECTS)
})

test('share codes round-trip and reject garbage', () => {
  const p = makePreset('  night shift ', captureSnapshot(), 1)
  expect(p.name).toBe('NIGHT SHIFT')
  const code = encodePreset(p)
  expect(code.startsWith('PIPME1.')).toBe(true)
  const back = decodePreset(code)
  expect(back?.name).toBe('NIGHT SHIFT')
  expect(sameSnapshot(back!.snapshot, p.snapshot)).toBe(true)
  expect(decodePreset('hello')).toBeNull()
  expect(decodePreset('PIPME1.@@@')).toBeNull()
})

test('default names count up', () => {
  expect(nextPresetName([])).toBe('PRESET 1')
  expect(nextPresetName([{ name: 'PRESET 1' }, { name: 'PRESET 3' }])).toBe('PRESET 2')
})
