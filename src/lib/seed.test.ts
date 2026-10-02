import { expect, test } from 'vitest'
import { hashString, mulberry32, randInt, rngFrom } from './seed'

test('hash is deterministic and spreads', () => {
  expect(hashString('VAULT DWELLER')).toBe(hashString('VAULT DWELLER'))
  expect(hashString('a')).not.toBe(hashString('b'))
})

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(42), b = mulberry32(42)
  for (let i = 0; i < 1000; i++) {
    const x = a()
    expect(x).toBe(b())
    expect(x).toBeGreaterThanOrEqual(0)
    expect(x).toBeLessThan(1)
  }
})

test('randInt covers the inclusive range', () => {
  const rng = rngFrom('range')
  const seen = new Set<number>()
  for (let i = 0; i < 500; i++) seen.add(randInt(rng, 1, 4))
  expect([...seen].sort()).toEqual([1, 2, 3, 4])
})
