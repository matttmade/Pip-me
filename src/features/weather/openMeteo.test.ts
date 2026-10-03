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
    expect(f.searchParams.get('current')).toContain('temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day')
    expect(f.searchParams.get('current')).toContain('wind_direction_10m')
    expect(f.searchParams.get('hourly')).toBe('temperature_2m,precipitation_probability,weather_code,uv_index')
    expect(f.searchParams.get('daily')).toContain('sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min')
    expect(f.searchParams.get('forecast_days')).toBe('5')
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
  it('defaults the new fields when the response lacks them', () => {
    const w = parseForecast(sample, 'F', 123)
    expect(w).toMatchObject({ windDir: null, gusts: null, humidity: null, hourly: [], daily: [], sunriseNext: null, uvNow: 5 })
  })
  it('keeps the 12 hours from the current one and the daily outlook', () => {
    const times = Array.from({ length: 30 }, (_, i) => `2026-10-02T${String(i % 24).padStart(2, '0')}:00`).map((t, i) =>
      i >= 24 ? t.replace('10-02', '10-03') : t,
    )
    const json = {
      ...sample,
      current: { ...sample.current, wind_direction_10m: 225.4, wind_gusts_10m: 18.6, relative_humidity_2m: 61 },
      hourly: {
        time: times,
        temperature_2m: times.map((_, i) => 50 + i),
        precipitation_probability: times.map((_, i) => i * 3),
        weather_code: times.map(() => 3),
        uv_index: times.map((_, i) => i / 4),
      },
      daily: {
        ...sample.daily,
        time: ['2026-10-02', '2026-10-03'],
        sunrise: ['2026-10-02T06:42', '2026-10-03T06:43'],
        temperature_2m_max: [74.1, 70],
        temperature_2m_min: [58.6, 55],
        weather_code: [2, 61],
        precipitation_probability_max: [10, 80],
        uv_index_max: [4.95, 3],
      },
    }
    // 14:30 local (-4h) → 18:30 UTC: the 14:00 hour is current.
    const w = parseForecast(json, 'F', Date.UTC(2026, 9, 2, 18, 30))
    expect(w.hourly).toHaveLength(12)
    expect(w.hourly[0]).toMatchObject({ at: Date.UTC(2026, 9, 2, 18, 0), temp: 64, precip: 42, code: 3, uv: 3.5 })
    expect(w.uvNow).toBe(3.5)
    expect(w).toMatchObject({ windDir: 225, gusts: 19, humidity: 61 })
    expect(w.sunriseNext).toBe(Date.UTC(2026, 9, 3, 10, 43))
    expect(w.daily).toEqual([
      { date: '2026-10-02', code: 2, hi: 74, lo: 59, precip: 10, uv: 5 },
      { date: '2026-10-03', code: 61, hi: 70, lo: 55, precip: 80, uv: 3 },
    ])
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
