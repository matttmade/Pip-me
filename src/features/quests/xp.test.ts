import { expect, test } from 'vitest'
import { XP_REWARD, xpForLevel, xpToLevel } from './xp'

test('xpForLevel curve', () => {
  expect([1, 2, 3, 4, 5].map(xpForLevel)).toEqual([0, 50, 150, 300, 500])
})

test('level boundaries', () => {
  expect(xpToLevel(0)).toEqual({ level: 1, progress: 0 })
  expect(xpToLevel(49).level).toBe(1)
  expect(xpToLevel(50)).toEqual({ level: 2, progress: 0 })
  expect(xpToLevel(149).level).toBe(2)
  expect(xpToLevel(150)).toEqual({ level: 3, progress: 0 })
  expect(xpToLevel(299).level).toBe(3)
  expect(xpToLevel(300).level).toBe(4)
})

test('progress is the fraction toward the next level', () => {
  expect(xpToLevel(25).progress).toBeCloseTo(0.5)
  expect(xpToLevel(100).progress).toBeCloseTo(0.5)
  expect(xpToLevel(225).progress).toBeCloseTo(0.5)
})

test('bad input clamps to level 1', () => {
  expect(xpToLevel(-10)).toEqual({ level: 1, progress: 0 })
  expect(xpToLevel(NaN)).toEqual({ level: 1, progress: 0 })
})

test('rewards', () => {
  expect(XP_REWARD).toEqual({ EASY: 10, MEDIUM: 25, HARD: 50 })
})
