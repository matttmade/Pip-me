import { describe, expect, it } from 'vitest'
import { pipRgb } from '../../effects/color'
import { APPALACHIA_TRACK_URL, buildWidgetUrl, rgbToHex, simulatedSignal, widgetVolume } from './soundcloud'

describe('rgbToHex', () => {
  it('pads, clamps and rounds', () => {
    expect(rgbToHex([0, 255, 16])).toBe('00ff10')
    expect(rgbToHex([-4, 300, 15.6])).toBe('00ff10')
  })
  it('works on pip hues', () => {
    expect(rgbToHex(pipRgb(120))).toMatch(/^[0-9a-f]{6}$/)
  })
})

describe('buildWidgetUrl', () => {
  it('builds a compact, looping-friendly player url', () => {
    const u = new URL(buildWidgetUrl(APPALACHIA_TRACK_URL, { color: '1aff80', autoPlay: true }))
    expect(u.origin + u.pathname).toBe('https://w.soundcloud.com/player/')
    const p = u.searchParams
    expect(p.get('url')).toBe(APPALACHIA_TRACK_URL)
    expect(p.get('color')).toBe('#1aff80')
    expect(p.get('auto_play')).toBe('true')
    expect(p.get('hide_related')).toBe('true')
    expect(p.get('show_comments')).toBe('false')
    expect(p.get('show_user')).toBe('true')
    expect(p.get('show_reposts')).toBe('false')
    expect(p.get('visual')).toBe('false')
  })
  it('encodes the track url and the # in color', () => {
    const s = buildWidgetUrl(APPALACHIA_TRACK_URL, { color: '#abcdef', autoPlay: false })
    expect(s).toContain('url=https%3A%2F%2Fsoundcloud.com%2F')
    expect(s).toContain('color=%23abcdef')
    expect(s).toContain('auto_play=false')
  })
})

describe('widgetVolume', () => {
  it('maps 0-1 to 0-100 and clamps', () => {
    expect(widgetVolume(0.5)).toBe(50)
    expect(widgetVolume(1.4)).toBe(100)
    expect(widgetVolume(-1)).toBe(0)
    expect(widgetVolume(NaN)).toBe(0)
  })
})

describe('simulatedSignal', () => {
  it('is flat at level 0 and bounded otherwise', () => {
    expect(simulatedSignal(0.3, 12, 0)).toBe(0)
    let peak = 0
    for (let i = 0; i <= 200; i++) {
      const v = simulatedSignal(i / 200, i * 0.37, 1)
      expect(Math.abs(v)).toBeLessThanOrEqual(1)
      peak = Math.max(peak, Math.abs(v))
    }
    expect(peak).toBeGreaterThan(0.1)
  })
  it('is deterministic', () => {
    expect(simulatedSignal(0.42, 3.3, 0.8)).toBe(simulatedSignal(0.42, 3.3, 0.8))
  })
})
