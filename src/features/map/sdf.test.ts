import { describe, expect, it } from 'vitest'
import { alphaToSdf, sdfToRgba } from './sdf'

describe('alphaToSdf', () => {
  // 21×21 coverage mask with a solid 7×7 square in the middle.
  const W = 21
  const mask = new Uint8Array(W * W)
  for (let y = 7; y < 14; y++) for (let x = 7; x < 14; x++) mask[y * W + x] = 255
  const sdf = alphaToSdf(mask, W, W, 8, 0.25)
  const at = (x: number, y: number) => sdf[y * W + x]

  it('is high inside, ~191 at the edge and falls off outside', () => {
    expect(at(10, 10)).toBeGreaterThan(220)
    expect(at(7, 10)).toBeGreaterThanOrEqual(191)
    expect(at(6, 10)).toBeLessThan(191)
    expect(at(6, 10)).toBeGreaterThan(at(3, 10))
    expect(at(0, 0)).toBe(0)
  })

  it('is symmetric for a symmetric shape', () => {
    expect(at(4, 10)).toBe(at(16, 10))
    expect(at(10, 4)).toBe(at(10, 16))
  })

  it('wraps into white RGBA with the field in alpha', () => {
    const rgba = sdfToRgba(sdf)
    expect(rgba).toHaveLength(W * W * 4)
    expect(Array.from(rgba.slice(0, 3))).toEqual([255, 255, 255])
    expect(rgba[(10 * W + 10) * 4 + 3]).toBe(at(10, 10))
  })
})
