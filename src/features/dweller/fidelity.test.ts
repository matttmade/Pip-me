import { describe, expect, it } from 'vitest'
import {
  bakeRamp,
  DEFAULT_DETAIL,
  DETAIL_LEVELS,
  detailProfile,
  normalizeDetail,
  rampStops,
  renderSize,
  sampleRamp,
  scanPeriod,
  toneCoord,
} from './fidelity'

describe('detail levels', () => {
  it('defaults to CLEAN and normalizes junk', () => {
    expect(DEFAULT_DETAIL).toBe('CLEAN')
    expect(normalizeDetail('HI-FI')).toBe('HI-FI')
    expect(normalizeDetail('RETRO')).toBe('RETRO')
    expect(normalizeDetail('ultra')).toBe('CLEAN')
    expect(normalizeDetail(null)).toBe('CLEAN')
  })

  it('RETRO keeps the original fixed low-res pipeline', () => {
    const p = detailProfile('RETRO')
    expect(p).toMatchObject({ smooth: false, maxDpr: 1, msaa: 0, bloom: 0, rim: 0, geometry: 'low', floor: false })
    expect(detailProfile('RETRO', true)).toEqual(p)
  })

  it('higher levels are smooth, and phones get a cheaper CLEAN', () => {
    for (const l of DETAIL_LEVELS.filter((x) => x !== 'RETRO')) {
      const p = detailProfile(l)
      expect(p.smooth).toBe(true)
      expect(p.maxDpr).toBeLessThanOrEqual(2)
      expect(p.msaa).toBeGreaterThan(0)
    }
    expect(detailProfile('CLEAN', true).maxDpr).toBeLessThan(detailProfile('CLEAN').maxDpr)
    expect(detailProfile('CLEAN', true).maxPixels).toBeLessThan(detailProfile('HI-FI', true).maxPixels)
    expect(detailProfile('HI-FI')).toMatchObject({ geometry: 'high', studioLights: true, floor: true })
  })
})

describe('renderSize', () => {
  it('scales the CSS box by the capped device pixel ratio', () => {
    expect(renderSize(300, 400, 3, 2)).toEqual({ width: 600, height: 800, pixelRatio: 2 })
    expect(renderSize(300, 400, 1.5, 2)).toEqual({ width: 450, height: 600, pixelRatio: 1.5 })
    expect(renderSize(300, 400, 0.5, 2).pixelRatio).toBe(1)
  })

  it('respects the pixel budget', () => {
    const s = renderSize(600, 800, 2, 2, 480_000)
    expect(s.width * s.height).toBeLessThanOrEqual(480_000 * 1.01)
    expect(s.pixelRatio).toBeCloseTo(1, 5)
  })

  it('falls back for an unmeasured box', () => {
    expect(renderSize(0, 0, 2, 2)).toEqual({ width: 240, height: 320, pixelRatio: 1 })
  })
})

describe('tone ramp', () => {
  const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

  it('runs dark → bright monotonically in the Pip hue', () => {
    const stops = rampStops(135)
    expect(stops[0].at).toBe(0)
    expect(stops.at(-1)?.at).toBe(1)
    let prev = -1
    for (let i = 0; i <= 20; i++) {
      const c = sampleRamp(stops, i / 20)
      expect(lum(c)).toBeGreaterThanOrEqual(prev - 0.5)
      prev = lum(c)
      if (i > 2) expect(c[1]).toBeGreaterThanOrEqual(Math.max(c[0], c[2])) // green dominates for hue 135
    }
  })

  it('hits the stops exactly and clamps out of range', () => {
    const stops = rampStops(38)
    expect(sampleRamp(stops, 0)).toEqual(stops[0].rgb)
    expect(sampleRamp(stops, 1)).toEqual(stops.at(-1)?.rgb)
    expect(sampleRamp(stops, stops[2].at)).toEqual(stops[2].rgb)
    expect(sampleRamp(stops, -3)).toEqual(stops[0].rgb)
    expect(sampleRamp(stops, 9)).toEqual(stops.at(-1)?.rgb)
  })

  it('bakes an opaque RGBA strip', () => {
    const px = bakeRamp(200, 64)
    expect(px.length).toBe(256)
    expect(px[3]).toBe(255)
    expect(Array.from(px.slice(252, 255))).toEqual(sampleRamp(rampStops(200), 1))
  })

  it('maps luminance with a lift and perceptual curve', () => {
    expect(toneCoord(0, 0.1)).toBeCloseTo(0.1)
    expect(toneCoord(1, 0.1)).toBeCloseTo(1)
    expect(toneCoord(0.25, 0)).toBeCloseTo(0.5)
    expect(toneCoord(4, 0)).toBe(1)
  })

  it('bands every 3 CSS px', () => {
    expect(scanPeriod(1)).toBe(3)
    expect(scanPeriod(2)).toBe(6)
    expect(scanPeriod(0.5)).toBe(2)
  })
})
