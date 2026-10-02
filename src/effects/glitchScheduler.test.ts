import { expect, test } from 'vitest'
import { mulberry32 } from '../lib/seed'
import { makeGlitch, nextDelay, onGlitchRequest, triggerGlitch } from './glitchScheduler'

const cfg = { on: true, frequency: 8, strength: 0.4, rgbSplit: false }

test('delay is frequency ±50%', () => {
  const rng = mulberry32(1)
  for (let i = 0; i < 500; i++) {
    const d = nextDelay(cfg, rng)
    expect(d).toBeGreaterThanOrEqual(4000)
    expect(d).toBeLessThan(12000)
  }
})

test('no glitches when off', () => {
  expect(nextDelay({ ...cfg, on: false }, mulberry32(1))).toBe(Infinity)
})

test('bursts are 80-250ms with 1-3 shifted slices', () => {
  const rng = mulberry32(7)
  for (let i = 0; i < 500; i++) {
    const g = makeGlitch(0.5, false, rng)
    expect(g.duration).toBeGreaterThanOrEqual(80)
    expect(g.duration).toBeLessThanOrEqual(250)
    const shifted = g.bands.filter((b) => b !== 0.5).length
    expect(shifted).toBeGreaterThanOrEqual(1)
    expect(shifted).toBeLessThanOrEqual(3)
    for (const b of g.bands) {
      expect(b).toBeGreaterThanOrEqual(0)
      expect(b).toBeLessThanOrEqual(1)
    }
    expect(g.rgb).toBe(0)
  }
})

test('strength scales displacement', () => {
  const weak = makeGlitch(0, true, mulberry32(3))
  const strong = makeGlitch(1, true, mulberry32(3))
  expect(strong.scale).toBeGreaterThan(weak.scale)
  expect(strong.rgb).toBeGreaterThan(weak.rgb)
})

test('trigger reaches subscribers', () => {
  const got: number[] = []
  const off = onGlitchRequest((r) => got.push(r.strength))
  triggerGlitch(0.3)
  off()
  triggerGlitch(0.9)
  expect(got).toEqual([0.3])
})
