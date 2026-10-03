import { describe, expect, it } from 'vitest'
import { gaugeAngle, pctHeight, scaleY, seriesRange, slotX, sparkPoints } from './chart'

describe('seriesRange / scaleY', () => {
  it('spans the data, widening flat series', () => {
    expect(seriesRange([50, 60, 55])).toEqual({ min: 50, max: 60 })
    expect(seriesRange([70, 70])).toEqual({ min: 68, max: 72 })
    expect(seriesRange([])).toBeNull()
  })
  it('maps max to top and min to bottom', () => {
    const r = { min: 50, max: 60 }
    expect(scaleY(60, r, 10, 50)).toBe(10)
    expect(scaleY(50, r, 10, 50)).toBe(50)
    expect(scaleY(55, r, 10, 50)).toBe(30)
  })
})

describe('sparkPoints / slotX', () => {
  it('centres points in equal slots', () => {
    expect(slotX(0, 4, 100)).toBe(12.5)
    expect(slotX(3, 4, 100)).toBe(87.5)
    expect(sparkPoints([50, 60], 100, 0, 40)).toBe('25,40 75,0')
    expect(sparkPoints([], 100, 0, 40)).toBe('')
  })
  it('puts a flat series in the middle', () => {
    expect(sparkPoints([5, 5], 20, 0, 40)).toBe('5,20 15,20')
  })
})

describe('pctHeight / gaugeAngle', () => {
  it('clamps and floors bar heights', () => {
    expect(pctHeight(50, 40)).toBe(20)
    expect(pctHeight(0, 40)).toBe(0)
    expect(pctHeight(1, 40, 2)).toBe(2)
    expect(pctHeight(150, 40)).toBe(40)
  })
  it('sweeps the gauge from -90 to 90', () => {
    expect(gaugeAngle(0, 12)).toBe(-90)
    expect(gaugeAngle(6, 12)).toBe(0)
    expect(gaugeAngle(20, 12)).toBe(90)
  })
})
