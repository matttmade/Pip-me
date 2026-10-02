import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../../lib/seed'
import {
  BEAT_MAX,
  BEAT_MIN,
  DEFAULT_FIGURE,
  eventGesture,
  GESTURES,
  GestureDirector,
  hueToHex,
  nextBeatDelay,
  normalizeFigure,
  REACT_GAP,
  tapGesture,
  WALK_CLIP,
} from './behavior'

describe('figure setting', () => {
  it('defaults to Vault Boy and accepts both figures', () => {
    expect(DEFAULT_FIGURE).toBe('VAULTBOY')
    expect(normalizeFigure('DWELLER')).toBe('DWELLER')
    expect(normalizeFigure('VAULTBOY')).toBe('VAULTBOY')
    expect(normalizeFigure('nope')).toBe('VAULTBOY')
    expect(normalizeFigure(undefined)).toBe('VAULTBOY')
  })
})

describe('hueToHex', () => {
  it('makes a #rrggbb string', () => {
    for (const h of [0, 38, 135, 200, 359]) expect(hueToHex(h)).toMatch(/^#[0-9a-f]{6}$/)
  })
  it('follows the hue: green is green-dominant, amber is red-dominant', () => {
    const g = hueToHex(135)
    expect(parseInt(g.slice(3, 5), 16)).toBe(255)
    const a = hueToHex(38)
    expect(parseInt(a.slice(1, 3), 16)).toBe(255)
    expect(parseInt(a.slice(5, 7), 16)).toBeLessThan(80)
  })
  it('wraps out-of-range hues', () => {
    expect(hueToHex(-225)).toBe(hueToHex(135))
    expect(hueToHex(495)).toBe(hueToHex(135))
  })
})

describe('gesture choice', () => {
  it('maps app events', () => {
    expect(eventGesture({ type: 'level-up', level: 2 })).toBe('cheer')
    expect(eventGesture({ type: 'headshot-set' })).toBe('thumbsUp')
    expect(eventGesture({ type: 'hack-result', success: true, daily: false })).toBe('flex')
    expect(eventGesture({ type: 'hack-result', success: false, daily: false })).toBeNull()
    expect(eventGesture({ type: 'list-move' })).toBeNull()
  })
  it('tap: thumbs-up is the most common, every gesture is reachable', () => {
    const rng = mulberry32(7)
    const n: Record<string, number> = {}
    for (let i = 0; i < 4000; i++) {
      const g = tapGesture(rng)
      n[g] = (n[g] ?? 0) + 1
    }
    for (const g of GESTURES) expect(n[g]).toBeGreaterThan(0)
    const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0][0]
    expect(top).toBe('thumbsUp')
    expect(tapGesture(() => 0.9999999)).toBeTypeOf('string')
  })
  it('ambient beats come every 12-20 s', () => {
    expect(nextBeatDelay(() => 0)).toBe(BEAT_MIN)
    expect(nextBeatDelay(() => 1)).toBe(BEAT_MAX)
  })
})

describe('GestureDirector', () => {
  it('walks, takes a beat within 20 s, then returns to the walk', () => {
    const d = new GestureDirector(mulberry32(1))
    const cmds: { t: number; c: string }[] = []
    for (let t = 0; t < 60; t += 1 / 30) {
      const c = d.tick(1 / 30)
      if (c) cmds.push({ t, c: `${c.type}:${c.name}` })
    }
    expect(cmds.length).toBeGreaterThanOrEqual(4)
    expect(cmds[0].t).toBeGreaterThanOrEqual(BEAT_MIN - 0.1)
    expect(cmds[0].t).toBeLessThanOrEqual(BEAT_MAX + 0.1)
    expect(cmds[0].c).not.toBe(`clip:${WALK_CLIP}`)
    expect(cmds[1].c).toBe(`clip:${WALK_CLIP}`)
    expect(cmds[1].t - cmds[0].t).toBeLessThan(4)
  })
  it('reactions interrupt immediately and then return to the walk', () => {
    const d = new GestureDirector(mulberry32(2))
    d.tick(1)
    expect(d.react('cheer')).toEqual({ type: 'pose', name: 'cheer' })
    expect(d.busy).toBe(true)
    let back = null
    for (let i = 0; i < 100 && !back; i++) back = d.tick(0.1)
    expect(back).toEqual({ type: 'clip', name: WALK_CLIP })
  })
  it('keeps the first of two near-simultaneous reactions', () => {
    const d = new GestureDirector(mulberry32(3))
    expect(d.react('thumbsUp')).not.toBeNull()
    expect(d.react('cheer')).toBeNull()
    d.tick(REACT_GAP + 0.01)
    expect(d.react('cheer')).toEqual({ type: 'pose', name: 'cheer' })
  })
})
