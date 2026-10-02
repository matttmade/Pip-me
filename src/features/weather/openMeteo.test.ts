import { describe, expect, it } from 'vitest'
import { forecastUrl, formatLocalTime, localIsoToEpoch, parseForecast, radsLevel } from './openMeteo'

const sample = {
  utc_offset_seconds: -14400,
  current: { temperature_2m: 71.6, apparent_temperature: 70.2, weather_code: 2, wind_speed_10m: 8.4, is_day: 1 },
  daily: {
    sunrise: ['2026-10-02T06:42'],
    sunset: ['2026-10-02T18:23'],
    uv_index_max: [4.95],
    temperature_2m_max: [74.1],
    temperature_2m_min: [58.6],
  },
}

describe('forecastUrl', () => {
  it('requests the spec fields with the unit setting', () => {
    const f = new URL(forecastUrl(42.3601, -71.0589, 'F'))
    expect(f.host).toBe('api.open-meteo.com')
    expect(f.searchParams.get('current')).toBe('temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day')
    expect(f.searchParams.get('daily')).toBe('sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min')
    expect(f.searchParams.get('timezone')).toBe('auto')
    expect(f.searchParams.get('temperature_unit')).toBe('fahrenheit')
    expect(new URL(forecastUrl(0, 0, 'C')).searchParams.get('temperature_unit')).toBe('celsius')
  })
})

describe('localIsoToEpoch / formatLocalTime', () => {
  it('converts location wall-clock time to epoch', () => {
    expect(localIsoToEpoch('2026-10-02T06:42', -14400)).toBe(Date.UTC(2026, 9, 2, 10, 42))
    expect(localIsoToEpoch('garbage', 0)).toBeNull()
    expect(localIsoToEpoch(undefined, 0)).toBeNull()
  })
  it('formats back in the location zone', () => {
    expect(formatLocalTime(Date.UTC(2026, 9, 2, 10, 42), -14400)).toBe('6:42 AM')
    expect(formatLocalTime(Date.UTC(2026, 9, 2, 22, 23), -14400)).toBe('6:23 PM')
    expect(formatLocalTime(Date.UTC(2026, 9, 2, 0, 5), 0)).toBe('12:05 AM')
  })
})

describe('parseForecast', () => {
  it('maps the response', () => {
    const w = parseForecast(sample, 'F', 123)
    expect(w).toMatchObject({ temp: 72, feels: 70, code: 2, label: 'PARTLY CLOUDY', wind: 8, windUnit: 'MPH', isDay: true, hi: 74, lo: 59, fetchedAt: 123 })
    expect(w.uv).toBeCloseTo(5, 0)
    expect(w.sunrise).toBe(Date.UTC(2026, 9, 2, 10, 42))
    expect(w.sunset).toBe(Date.UTC(2026, 9, 2, 22, 23))
  })
  it('throws without current conditions', () => {
    expect(() => parseForecast({}, 'C')).toThrow()
  })
})

describe('radsLevel', () => {
  it('buckets UV', () => {
    expect(radsLevel(0)).toBe('LOW')
    expect(radsLevel(5)).toBe('MODERATE')
    expect(radsLevel(11.5)).toBe('EXTREME')
  })
})
