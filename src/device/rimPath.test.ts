import { expect, test } from 'vitest'
import { rimPath } from './rimPath'

const spec = { w: 1000, h: 600, radius: 30, offset: 8, topGap: 200, bottomGap: 120, tick: 5 }

test('gaps are centred on the top and bottom edges', () => {
  const d = rimPath(spec)
  // top gap edges at 500 ± 100, bottom at 500 ± 60
  expect(d).toContain('M600 -8')
  expect(d).toContain('L400 -8')
  expect(d).toContain('L560 608')
  expect(d).toContain('M440 608')
})

test('gaps never eat into the rounded corners', () => {
  const d = rimPath({ ...spec, w: 200, topGap: 900, bottomGap: 900 })
  const xs = [...d.matchAll(/[ML](-?[\d.]+) -8/g)].map((m) => Number(m[1]))
  for (const x of xs) {
    expect(x).toBeGreaterThanOrEqual(-8 + 38 - 0.01)
    expect(x).toBeLessThanOrEqual(208 - 38 + 0.01)
  }
})
