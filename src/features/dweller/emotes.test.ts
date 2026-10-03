import { describe, expect, it, vi } from 'vitest'
import { DWELLER_MOVE, EMOTES, emoteForKey, MOVE_SECS, moveOffset, onEmote, requestEmote, type DwellerMove } from './emotes'
import { GESTURES } from './vaultboy/behavior'

describe('emotes', () => {
  it('covers every Vault Boy gesture once, keys 1-6', () => {
    expect(EMOTES.map((e) => e.id).sort()).toEqual([...GESTURES].sort())
    expect(EMOTES.map((e) => e.key)).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('maps number keys', () => {
    expect(emoteForKey('1')).toBe('wave')
    expect(emoteForKey('5')).toBe('cheer')
    expect(emoteForKey('7')).toBeNull()
    expect(emoteForKey('a')).toBeNull()
  })

  it('delivers requests to listeners until they unsubscribe', () => {
    const fn = vi.fn()
    expect(requestEmote('wave')).toBe(false)
    const off = onEmote(fn)
    expect(requestEmote('flex')).toBe(true)
    expect(fn).toHaveBeenCalledWith('flex')
    off()
    expect(requestEmote('wave')).toBe(false)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('moveOffset', () => {
  const moves: DwellerMove[] = ['hop', 'bounce', 'spin']
  it('starts and ends at rest', () => {
    for (const m of moves) {
      expect(moveOffset(m, 0)).toEqual({ y: 0, yaw: 0 })
      expect(moveOffset(m, MOVE_SECS[m])).toEqual({ y: 0, yaw: 0 })
      expect(moveOffset(m, -1)).toEqual({ y: 0, yaw: 0 })
    }
  })
  it('lifts mid-move and spins a full turn', () => {
    expect(moveOffset('hop', MOVE_SECS.hop / 2).y).toBeCloseTo(0.22)
    expect(moveOffset('bounce', MOVE_SECS.bounce / 4).y).toBeGreaterThan(0)
    expect(moveOffset('spin', MOVE_SECS.spin / 2).yaw).toBeCloseTo(Math.PI)
    expect(moveOffset('spin', MOVE_SECS.spin * 0.999).yaw).toBeGreaterThan(6)
  })
  it('gives every gesture a Dweller move', () => {
    for (const g of GESTURES) expect(MOVE_SECS[DWELLER_MOVE[g]]).toBeGreaterThan(0)
  })
})
