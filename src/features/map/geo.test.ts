import { afterEach, describe, expect, it, vi } from 'vitest'
import { coordKey, formatCoords, formatNominatim, reverseGeocode, toPlace } from './geo'

describe('formatCoords', () => {
  it('formats hemispheres with 2 decimals', () => {
    expect(formatCoords(42.3601, -71.0589)).toBe('42.36°N 71.06°W')
    expect(formatCoords(-33.8688, 151.2093)).toBe('33.87°S 151.21°E')
    expect(formatCoords(0, 0)).toBe('0.00°N 0.00°E')
  })
})

describe('coordKey', () => {
  it('rounds to 3 decimals', () => {
    expect(coordKey(42.36014, -71.05891)).toBe('42.360,-71.059')
  })
})

describe('formatNominatim', () => {
  it('uses city + state code', () => {
    expect(
      formatNominatim({ address: { city: 'Boston', state: 'Massachusetts', 'ISO3166-2-lvl4': 'US-MA', country: 'United States' } }),
    ).toBe('BOSTON, MA')
  })
  it('falls back to town/state/country', () => {
    expect(formatNominatim({ address: { town: 'Lexington', state: 'North Carolina' } })).toBe('LEXINGTON, NORTH CAROLINA')
    expect(formatNominatim({ address: { village: 'Hallstatt', country: 'Austria' } })).toBe('HALLSTATT, AUSTRIA')
  })
  it('returns null when nothing is usable', () => {
    expect(formatNominatim({})).toBeNull()
    expect(formatNominatim(null)).toBeNull()
  })
})

describe('toPlace', () => {
  it('builds an uppercase label', () => {
    expect(toPlace({ name: 'Salem', latitude: 42.5, longitude: -70.9, admin1: 'Massachusetts', country: 'United States' })).toEqual({
      lat: 42.5,
      lon: -70.9,
      label: 'SALEM, MASSACHUSETTS',
    })
  })
})

describe('reverseGeocode', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns formatted coords when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(reverseGeocode(10.5, 20.25)).resolves.toBe('10.50°N 20.25°E')
  })

  it('caches successful lookups by rounded coords', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { city: 'Boston', 'ISO3166-2-lvl4': 'US-MA' } }) })
    vi.stubGlobal('fetch', fetch)
    await expect(reverseGeocode(42.36011, -71.05891)).resolves.toBe('BOSTON, MA')
    await expect(reverseGeocode(42.36014, -71.05889)).resolves.toBe('BOSTON, MA')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
