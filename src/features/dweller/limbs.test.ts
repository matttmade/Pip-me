import { expect, it } from 'vitest'
import { LIMBS, limbCondition } from './limbs'

it('is deterministic, case-insensitive and in range', () => {
  const a = limbCondition('Nora')
  expect(limbCondition(' NORA ')).toEqual(a)
  for (const l of LIMBS) {
    expect(a[l]).toBeGreaterThanOrEqual(0.55)
    expect(a[l]).toBeLessThanOrEqual(1)
  }
  expect(limbCondition('Nate')).not.toEqual(a)
})
