import { wmoToLabel } from './wmo'

export type Units = 'F' | 'C'

export type Weather = {
  temp: number
  feels: number
  code: number
  label: string
  wind: number
  windUnit: 'MPH' | 'KM/H'
  isDay: boolean
  /** RADS = today's max UV index. */
  uv: number
  hi: number
  lo: number
  units: Units
  /** Epoch ms. */
  sunrise: number | null
  sunset: number | null
  /** Seconds east of UTC at the forecast location (for showing local times). */
  utcOffset: number
  fetchedAt: number
}

export function forecastUrl(lat: number, lon: number, units: Units): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day',
    daily: 'sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min',
    timezone: 'auto',
    forecast_days: '1',
    temperature_unit: units === 'F' ? 'fahrenheit' : 'celsius',
    wind_speed_unit: units === 'F' ? 'mph' : 'kmh',
  })
  return `https://api.open-meteo.com/v1/forecast?${q}`
}

/** "2026-10-02T06:42" in a zone `offsetSec` east of UTC → epoch ms. */
export function localIsoToEpoch(iso: string | undefined | null, offsetSec: number): number | null {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h, mi] = m.map(Number)
  return Date.UTC(y, mo - 1, d, h, mi) - offsetSec * 1000
}

/** Epoch ms → "6:42 AM" as a wall clock `offsetSec` east of UTC. */
export function formatLocalTime(epoch: number, offsetSec: number): string {
  const d = new Date(epoch + offsetSec * 1000)
  const h = d.getUTCHours()
  const m = d.getUTCMinutes()
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

type Num = number | null | undefined
type ForecastJson = {
  utc_offset_seconds?: number
  current?: { temperature_2m?: Num; apparent_temperature?: Num; weather_code?: Num; wind_speed_10m?: Num; is_day?: Num }
  daily?: { sunrise?: string[]; sunset?: string[]; uv_index_max?: Num[]; temperature_2m_max?: Num[]; temperature_2m_min?: Num[] }
}

export function parseForecast(json: ForecastJson, units: Units, now = Date.now()): Weather {
  const c = json.current
  if (!c || c.temperature_2m == null) throw new Error('forecast: no current conditions')
  const off = json.utc_offset_seconds ?? 0
  const d = json.daily ?? {}
  const code = c.weather_code ?? -1
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature ?? c.temperature_2m),
    code,
    label: wmoToLabel(code),
    wind: Math.round(c.wind_speed_10m ?? 0),
    windUnit: units === 'F' ? 'MPH' : 'KM/H',
    isDay: c.is_day !== 0,
    uv: Math.round((d.uv_index_max?.[0] ?? 0) * 10) / 10,
    hi: Math.round(d.temperature_2m_max?.[0] ?? c.temperature_2m),
    lo: Math.round(d.temperature_2m_min?.[0] ?? c.temperature_2m),
    units,
    sunrise: localIsoToEpoch(d.sunrise?.[0], off),
    sunset: localIsoToEpoch(d.sunset?.[0], off),
    utcOffset: off,
    fetchedAt: now,
  }
}

export async function getWeather(lat: number, lon: number, units: Units, signal?: AbortSignal): Promise<Weather> {
  const res = await fetch(forecastUrl(lat, lon, units), { signal })
  if (!res.ok) throw new Error(`open-meteo ${res.status}`)
  return parseForecast(await res.json(), units)
}

/** RADS reading (UV index) → a severity word, for flavor. */
export function radsLevel(uv: number): string {
  return uv < 3 ? 'LOW' : uv < 6 ? 'MODERATE' : uv < 8 ? 'HIGH' : uv < 11 ? 'VERY HIGH' : 'EXTREME'
}
