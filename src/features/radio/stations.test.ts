import { describe, expect, it } from 'vitest'
import { morseTimeline, STATIONS } from './stations'

describe('morseTimeline', () => {
  it('uses standard unit spacing', () => {
    // S = ..., O = ---: dots 1u, dashes 3u, 1u between symbols, 3u between letters.
    const { beeps } = morseTimeline('SO')
    expect(beeps).toEqual([
      [0, 1],
      [2, 1],
      [4, 1],
      [8, 3],
      [12, 3],
      [16, 3],
    ])
  })

  it('separates words by 7 units and ignores unknown characters', () => {
    const { beeps } = morseTimeline('E E?')
    expect(beeps).toEqual([
      [0, 1],
      [8, 1],
    ])
  })
})

describe('stations', () => {
  it('have unique ids and names', () => {
    expect(new Set(STATIONS.map((s) => s.id)).size).toBe(STATIONS.length)
    expect(new Set(STATIONS.map((s) => s.name)).size).toBe(STATIONS.length)
  })
})
