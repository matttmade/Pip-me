import { expect, test } from 'vitest'
import { applyPreset, DEFAULT_EFFECTS, patchConfig, PRESETS, stillVersion } from './presets'

test('every preset produces a complete config', () => {
  for (const name of Object.keys(PRESETS) as (keyof typeof PRESETS)[]) {
    const cfg = applyPreset(name, 200)
    expect(cfg.preset).toBe(name)
    expect(cfg.hue).toBe(200)
    for (const k of ['scanlines', 'noise', 'glitch', 'flicker', 'rollBar', 'glow', 'vignette', 'curvature'])
      expect(cfg).toHaveProperty(k)
  }
})

test('default is the PIP-ME house preset', () => {
  expect(DEFAULT_EFFECTS.preset).toBe('PIP-ME')
  expect(DEFAULT_EFFECTS.hue).toBe(150)
  expect(DEFAULT_EFFECTS.rollBar.interval).toBe(17)
})

test('presets are independent copies', () => {
  const a = applyPreset('CLASSIC')
  a.scanlines.opacity = 0.9
  expect(applyPreset('CLASSIC').scanlines.opacity).toBe(0.25)
})

test('editing a knob switches to CUSTOM and merges sections', () => {
  const next = patchConfig(DEFAULT_EFFECTS, { scanlines: { opacity: 0.5 } })
  expect(next.preset).toBe('CUSTOM')
  expect(next.scanlines).toEqual({ ...DEFAULT_EFFECTS.scanlines, opacity: 0.5 })
})

test('changing hue keeps the preset', () => {
  const next = patchConfig(DEFAULT_EFFECTS, { hue: 38 })
  expect(next.preset).toBe('PIP-ME')
  expect(next.hue).toBe(38)
})

test('selecting a preset loads it and keeps hue', () => {
  const amber = patchConfig(DEFAULT_EFFECTS, { hue: 38 })
  const dmg = patchConfig(amber, { preset: 'DAMAGED' })
  expect(dmg.preset).toBe('DAMAGED')
  expect(dmg.glitch.rgbSplit).toBe(true)
  expect(dmg.hue).toBe(38)
})

test('still version removes all motion', () => {
  const s = stillVersion(applyPreset('DAMAGED'))
  expect(s.scanlines.speed).toBe(0)
  expect(s.noise.fps).toBe(0)
  expect(s.glitch.on || s.flicker.on || s.rollBar.on).toBe(false)
})

test('partial or malformed stored configs are repaired', async () => {
  const { normalizeConfig } = await import('./presets')
  const fixed = normalizeConfig({ hue: 38, scanlines: { opacity: 0.5 }, glow: 'x' })
  expect(fixed.hue).toBe(38)
  expect(fixed.scanlines.on).toBe(DEFAULT_EFFECTS.scanlines.on)
  expect(fixed.scanlines.opacity).toBe(0.5)
  expect(fixed.glitch).toEqual(DEFAULT_EFFECTS.glitch)
  expect(fixed.glow).toBe(DEFAULT_EFFECTS.glow)
  expect(normalizeConfig(null)).toBe(DEFAULT_EFFECTS)
})
