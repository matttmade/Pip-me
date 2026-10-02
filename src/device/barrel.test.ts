import { expect, test } from 'vitest'
import { barrelMap, curvatureToK } from './barrel'

const px = (m: ReturnType<typeof barrelMap>, x: number, y: number) => {
  const i = (y * m.width + x) * 4
  return [m.data[i], m.data[i + 1]]
}

test('center is undisplaced, corners push outward', () => {
  const m = barrelMap(65, 65, 1000, 800, 0.03)
  const [cr, cg] = px(m, 32, 32)
  expect(Math.abs(cr - 128)).toBeLessThanOrEqual(1)
  expect(Math.abs(cg - 128)).toBeLessThanOrEqual(1)
  const [r, g] = px(m, 64, 64) // bottom-right samples further right/down
  expect(r).toBeGreaterThan(200)
  expect(g).toBeGreaterThan(190)
  const [r0, g0] = px(m, 0, 0)
  expect(r0).toBeLessThan(60)
  expect(g0).toBeLessThan(70)
})

test('values stay in range and k=0 is flat', () => {
  const flat = barrelMap(10, 10, 500, 500, 0)
  for (let i = 0; i < flat.data.length; i += 4) expect(flat.data[i]).toBe(128)
  expect(curvatureToK(2)).toBeCloseTo(0.045)
  expect(curvatureToK(-1)).toBe(0)
})
