import { describe, expect, it } from 'vitest'
import { CENTER_CROP, clampCrop, computeCropRect, MAX_SCALE, panCrop, zoomCrop } from './cropMath'

describe('computeCropRect', () => {
  it('centres the largest square in a landscape image', () => {
    expect(computeCropRect(400, 200, CENTER_CROP, 256)).toEqual({ sx: 100, sy: 0, sw: 200, sh: 200, dx: 0, dy: 0, dw: 256, dh: 256 })
  })

  it('centres the largest square in a portrait image', () => {
    expect(computeCropRect(300, 600, CENTER_CROP, 256)).toMatchObject({ sx: 0, sy: 150, sw: 300, sh: 300, dw: 256, dh: 256 })
  })

  it('zoom shrinks the window around the centre', () => {
    expect(computeCropRect(400, 400, { x: 0.5, y: 0.5, scale: 2 }, 128)).toMatchObject({ sx: 100, sy: 100, sw: 200, sh: 200, dw: 128 })
  })

  it('clamps the window inside the image at every edge', () => {
    for (const [x, y] of [[-1, -1], [2, 2], [0, 1], [1, 0]]) {
      for (const [w, h] of [[400, 200], [200, 400], [333, 333]]) {
        for (const scale of [1, 1.7, 3]) {
          const r = computeCropRect(w, h, { x, y, scale }, 256)
          expect(r.sx).toBeGreaterThanOrEqual(-1e-9)
          expect(r.sy).toBeGreaterThanOrEqual(-1e-9)
          expect(r.sx + r.sw).toBeLessThanOrEqual(w + 1e-9)
          expect(r.sy + r.sh).toBeLessThanOrEqual(h + 1e-9)
          expect(r.sw).toBeCloseTo(Math.min(w, h) / scale)
        }
      }
    }
  })

  it('clamps zoom to [1, MAX_SCALE] and survives NaN input', () => {
    expect(clampCrop(100, 100, { x: 0.5, y: 0.5, scale: 0.2 }).scale).toBe(1)
    expect(clampCrop(100, 100, { x: 0.5, y: 0.5, scale: 99 }).scale).toBe(MAX_SCALE)
    expect(clampCrop(100, 100, { x: NaN, y: NaN, scale: NaN })).toEqual(CENTER_CROP)
  })

  it('rejects empty images', () => {
    expect(() => computeCropRect(0, 10, CENTER_CROP, 256)).toThrow(RangeError)
  })
})

describe('panCrop / zoomCrop', () => {
  it('dragging right moves the window left (image follows the pointer)', () => {
    const c = panCrop(400, 200, CENTER_CROP, 50, 0, 200) // 200px guide shows 200 source px → 1:1
    expect(c.x).toBeCloseTo((200 - 50) / 400)
    expect(c.y).toBe(0.5)
  })

  it('cannot pan a square image at zoom 1', () => {
    expect(panCrop(300, 300, CENTER_CROP, 80, -80, 300)).toEqual(CENTER_CROP)
  })

  it('zooms multiplicatively and clamps', () => {
    expect(zoomCrop(100, 100, CENTER_CROP, 2).scale).toBe(2)
    expect(zoomCrop(100, 100, { x: 0.5, y: 0.5, scale: 3 }, 10).scale).toBe(MAX_SCALE)
    // zooming out from an edge pulls the window back inside
    expect(zoomCrop(400, 400, { x: 0.25, y: 0.25, scale: 2 }, 0.5)).toEqual(CENTER_CROP)
  })
})
