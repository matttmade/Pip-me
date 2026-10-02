import { describe, expect, it } from 'vitest'
import { bearingDeg, compass, distanceM, formatDistance, formatVector, nearestPois, pickRegion, pointInPolygon, type Poi } from './regions'

const BOSTON: [number, number] = [-71.06, 42.355]

describe('distance / bearing', () => {
  it('measures great-circle distance', () => {
    // ~111.2 km per degree of latitude
    expect(distanceM([0, 0], [0, 1])).toBeCloseTo(111_195, -2)
    expect(distanceM(BOSTON, BOSTON)).toBe(0)
  })
  it('gives compass bearings', () => {
    expect(bearingDeg([0, 0], [0, 1])).toBeCloseTo(0)
    expect(bearingDeg([0, 0], [1, 0])).toBeCloseTo(90)
    expect(bearingDeg([0, 0], [0, -1])).toBeCloseTo(180)
    expect(bearingDeg([0, 0], [-1, 0])).toBeCloseTo(270)
    expect(compass(44)).toBe('NE')
    expect(compass(359)).toBe('N')
    expect(compass(-90)).toBe('W')
  })
})

describe('formatDistance / formatVector', () => {
  it('rounds metres and switches to km', () => {
    expect(formatDistance(42)).toBe('40 M')
    expect(formatDistance(347)).toBe('350 M')
    expect(formatDistance(1234)).toBe('1.2 KM')
    expect(formatDistance(14_600)).toBe('15 KM')
  })
  it('combines distance, compass point and bearing', () => {
    expect(formatVector([0, 0], [0.01, 0])).toBe('1.1 KM E 090°')
  })
})

describe('nearestPois', () => {
  const poi = (name: string, lon: number, lat: number, cat: Poi['cat'] = 'diner'): Poi => ({ key: name + lon, name, cat, lon, lat })
  it('dedupes by name + category and sorts by distance', () => {
    const list = nearestPois(
      [poi('Far', -71.07, 42.36), poi('Near', -71.0601, 42.355), poi('Near', -71.0602, 42.355), poi('Mid', -71.062, 42.355)],
      BOSTON,
    )
    expect(list.map((p) => p.name)).toEqual(['Near', 'Mid', 'Far'])
    expect(list[0].dist).toBeLessThan(10)
  })
  it('limits the count', () => {
    const many = Array.from({ length: 20 }, (_, i) => poi(`P${i}`, -71.06 + i * 0.001, 42.355))
    expect(nearestPois(many, BOSTON, 8)).toHaveLength(8)
  })
})

describe('pointInPolygon', () => {
  const square = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] }
  it('respects the outer ring and holes', () => {
    expect(pointInPolygon([1, 1], square)).toBe(true)
    expect(pointInPolygon([5, 5], square)).toBe(false) // in the hole
    expect(pointInPolygon([11, 5], square)).toBe(false)
  })
  it('handles multipolygons and ignores other geometry', () => {
    const multi = { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]] }
    expect(pointInPolygon([25, 25], multi)).toBe(true)
    expect(pointInPolygon([0, 0], { type: 'Point', coordinates: [0, 0] })).toBe(false)
  })
})

describe('pickRegion', () => {
  const places = [
    { name: 'Boston', cls: 'city', lon: -71.0589, lat: 42.3601 },
    { name: 'Downtown', cls: 'suburb', lon: -71.058, lat: 42.356 },
    { name: 'Back Bay', cls: 'suburb', lon: -71.081, lat: 42.35 },
  ]
  it('takes a named area that contains the center first', () => {
    const park = { name: 'Boston Common', geometry: { type: 'Polygon', coordinates: [[[-71.07, 42.35], [-71.05, 42.35], [-71.05, 42.36], [-71.07, 42.36], [-71.07, 42.35]]] } }
    expect(pickRegion(BOSTON, places, [park])).toBe('Boston Common')
  })
  it('else the nearest neighbourhood label nearby', () => {
    expect(pickRegion(BOSTON, places)).toBe('Downtown')
    expect(pickRegion([-71.08, 42.35], places)).toBe('Back Bay')
  })
  it('else the nearest settlement, else null', () => {
    expect(pickRegion([-71.2, 42.4], places)).toBe('Boston')
    expect(pickRegion(BOSTON, [])).toBeNull()
  })
})
