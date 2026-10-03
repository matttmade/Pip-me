import { describe, expect, it } from 'vitest'
import { headingFromOrientation } from './heading'
import { leafletFilter } from './view'

describe('leafletFilter', () => {
  it('chains grayscale → invert → sepia → hue-rotate toward the Pip hue', () => {
    const f = leafletFilter(135)
    expect(f.indexOf('grayscale')).toBeLessThan(f.indexOf('invert'))
    expect(f.indexOf('invert')).toBeLessThan(f.indexOf('sepia'))
    expect(f).toContain('hue-rotate(97deg)')
  })
  it('wraps negative rotations', () => {
    expect(leafletFilter(20)).toContain('hue-rotate(342deg)')
  })
})

describe('headingFromOrientation', () => {
  it('prefers the iOS compass heading', () => {
    expect(headingFromOrientation({ alpha: 10, webkitCompassHeading: 270 })).toBe(270)
  })
  it('converts absolute alpha (counter-clockwise) to a compass heading', () => {
    expect(headingFromOrientation({ alpha: 90, absolute: true })).toBe(270)
  })
  it('ignores relative orientation', () => {
    expect(headingFromOrientation({ alpha: 90, absolute: false })).toBeNull()
  })
})
