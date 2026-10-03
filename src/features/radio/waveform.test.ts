import { describe, expect, it } from 'vitest'
import { envelopeAt, envelopeSignal, envelopeSlope, envelopeWindow, extrapolatePlayhead, normalizeEnvelope, waveformJsonUrl } from './waveform'

describe('waveformJsonUrl', () => {
  it('turns the png waveform into its json variant', () => {
    expect(waveformJsonUrl('https://wave.sndcdn.com/mWLti0k5qTR2_m.png')).toBe('https://wave.sndcdn.com/mWLti0k5qTR2_m.json')
    expect(waveformJsonUrl('https://wave.sndcdn.com/mWLti0k5qTR2_m.json')).toBe('https://wave.sndcdn.com/mWLti0k5qTR2_m.json')
  })
  it('rejects anything else', () => {
    expect(waveformJsonUrl(undefined)).toBeNull()
    expect(waveformJsonUrl('http://wave.sndcdn.com/a_m.png')).toBeNull()
    expect(waveformJsonUrl('https://evil.example/a_m.json')).toBeNull()
    expect(waveformJsonUrl('https://wave.sndcdn.com.evil.example/a_m.json')).toBeNull()
  })
})

describe('normalizeEnvelope', () => {
  it('rejects malformed payloads', () => {
    expect(normalizeEnvelope(null)).toBeNull()
    expect(normalizeEnvelope({ samples: 'x' })).toBeNull()
    expect(normalizeEnvelope({ samples: [1] })).toBeNull()
    expect(normalizeEnvelope({ samples: [0, 0, 0], height: 0 })).toBeNull()
  })
  it('stretches the range into 0.1..1', () => {
    const samples = Array.from({ length: 200 }, (_, i) => 20 + (i % 100))
    const env = normalizeEnvelope({ width: 200, height: 140, samples })!
    expect(env).toHaveLength(200)
    expect(Math.min(...env)).toBeCloseTo(0.1, 1)
    expect(Math.max(...env)).toBeCloseTo(1, 1)
    for (const v of env) expect(v >= 0 && v <= 1).toBe(true)
  })
  it('keeps a flat waveform flat and treats junk samples as silence', () => {
    const flat = normalizeEnvelope({ height: 100, samples: [50, 50, 50, 50] })!
    expect(flat[0]).toBeCloseTo(0.5)
    const env = normalizeEnvelope({ height: 100, samples: [50, 50, 'x', 50] })!
    expect(env[2]).toBeLessThan(env[0])
    expect(env[0]).toBeCloseTo(1)
  })
})

describe('envelopeAt / envelopeSlope', () => {
  const env = Float32Array.from([0, 1, 0.5])
  it('interpolates between samples across the duration', () => {
    expect(envelopeAt(env, 0, 1000)).toBe(0)
    expect(envelopeAt(env, 250, 1000)).toBeCloseTo(0.5)
    expect(envelopeAt(env, 500, 1000)).toBeCloseTo(1)
    expect(envelopeAt(env, 1000, 1000)).toBeCloseTo(0.5)
  })
  it('clamps outside the track and handles unknown length', () => {
    expect(envelopeAt(env, -50, 1000)).toBe(0)
    expect(envelopeAt(env, 5000, 1000)).toBeCloseTo(0.5)
    expect(envelopeAt(env, 300, 0)).toBe(0)
    expect(envelopeAt(new Float32Array(0), 1, 10)).toBe(0)
  })
  it('reports swells and fades', () => {
    expect(envelopeSlope(env, 100, 1000)).toBeCloseTo(1)
    expect(envelopeSlope(env, 700, 1000)).toBeCloseTo(-0.5)
    expect(envelopeSlope(env, 1000, 1000)).toBeCloseTo(-0.5)
  })
})

describe('envelopeWindow', () => {
  it('centers on the playhead and pads outside the track with silence', () => {
    const env = Float32Array.from([1, 1, 1])
    const w = envelopeWindow(env, 0, 1000, 1000, 10)
    expect(w).toHaveLength(10)
    expect(w.slice(0, 5).every((v) => v === 0)).toBe(true)
    expect(w.slice(5).every((v) => v === 1)).toBe(true)
    expect(envelopeWindow(env, 0, 0, 1000, 10)).toEqual([])
  })
})

describe('extrapolatePlayhead', () => {
  it('advances with wall time only while playing', () => {
    expect(extrapolatePlayhead(1000, 0, 400, true, 10_000)).toBe(1400)
    expect(extrapolatePlayhead(1000, 0, 400, false, 10_000)).toBe(1000)
  })
  it('caps the gap and stays inside the track', () => {
    expect(extrapolatePlayhead(1000, 0, 60_000, true, 100_000)).toBe(2500)
    expect(extrapolatePlayhead(9900, 0, 1000, true, 10_000)).toBe(10_000)
    expect(extrapolatePlayhead(1000, 500, 0, true, 10_000)).toBe(1000)
  })
})

describe('envelopeSignal', () => {
  it('is silent at zero level and bounded otherwise', () => {
    expect(envelopeSignal(0.4, 3, 0)).toBe(0)
    for (let i = 0; i < 300; i++) {
      const v = envelopeSignal(i / 300, i * 0.13, 1, (i % 7) / 7 - 0.5)
      expect(v >= -1 && v <= 1).toBe(true)
    }
  })
  it('gets taller as the music gets louder', () => {
    const peak = (level: number) => {
      let m = 0
      for (let i = 0; i < 400; i++) m = Math.max(m, Math.abs(envelopeSignal(i / 400, 2.2, level)))
      return m
    }
    expect(peak(0.9)).toBeGreaterThan(peak(0.3) * 2)
  })
  it('is deterministic', () => {
    expect(envelopeSignal(0.42, 3.3, 0.8, 0.1)).toBe(envelopeSignal(0.42, 3.3, 0.8, 0.1))
  })
})
