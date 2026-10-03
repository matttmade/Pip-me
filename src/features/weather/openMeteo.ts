import { wmoToLabel } from './wmo'

export type Units = 'F' | 'C'

/** One hour of the short-range forecast. */
export type HourPoint = { at: number; temp: number; precip: number; code: number; uv: number }
/** One day of the multi-day outlook. `date` is the location's calendar day, `YYYY-MM-DD`. */
export type DayPoint = { date: string; code: number; hi: number; lo: number; precip: number; uv: number }

export type Weather = {
  temp: number
  feels: number
  code: number
  label: string
  wind: number
  windUnit: 'MPH' | 'KM/H'
  /** Degrees the wind blows FROM (meteorological), null if unknown. */
  windDir: number | null
  gusts: number | null
  humidity: number | null
  isDay: boolean
  /** RADS = today's max UV index. */
  uv: number
  /** UV index for the current hour (falls back to today's max). */
  uvNow: number
  hi: number
  lo: number
  units: Units
  /** Epoch ms. */
  sunrise: number | null
  sunset: number | null
  /** Tomorrow's sunrise / sunset (for countdowns after dark). */
  sunriseNext: number | null
  sunsetNext: number | null
  /** Seconds east of UTC at the forecast location (for showing local times). */
  utcOffset: number
  /** Next 12 hours, starting with the current hour. */
  hourly: HourPoint[]
  /** Today plus the next days (up to 5). */
  daily: DayPoint[]
  fetchedAt: number
}

export const FORECAST_DAYS = 5
export const FORECAST_HOURS = 12

export function forecastUrl(lat: number, lon: number, units: Units): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current:
      'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,wind_direction_10m,wind_gusts_10m,relative_humidity_2m',
    hourly: 'temperature_2m,precipitation_probability,weather_code,uv_index',
    daily: 'sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS),
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

/** Epoch ms → "6A" / "12P", the hour as a wall clock `offsetSec` east of UTC. */
export function formatLocalHour(epoch: number, offsetSec: number): string {
  const h = new Date(epoch + offsetSec * 1000).getUTCHours()
  return `${h % 12 || 12}${h < 12 ? 'A' : 'P'}`
}

type Num = number | null | undefined
type ForecastJson = {
  utc_offset_seconds?: number
  current?: {
    temperature_2m?: Num
    apparent_temperature?: Num
    weather_code?: Num
    wind_speed_10m?: Num
    is_day?: Num
    wind_direction_10m?: Num
    wind_gusts_10m?: Num
    relative_humidity_2m?: Num
  }
  hourly?: { time?: string[]; temperature_2m?: Num[]; precipitation_probability?: Num[]; weather_code?: Num[]; uv_index?: Num[] }
  daily?: {
    time?: string[]
    sunrise?: string[]
    sunset?: string[]
    uv_index_max?: Num[]
    temperature_2m_max?: Num[]
    temperature_2m_min?: Num[]
    weather_code?: Num[]
    precipitation_probability_max?: Num[]
  }
}

const round = (v: Num): number | null => (v == null || Number.isNaN(v) ? null : Math.round(v))
const tenths = (v: Num) => Math.round((v ?? 0) * 10) / 10

/** The 12 hours from the one containing `now` (hourly times are location wall-clock). */
function parseHourly(h: ForecastJson['hourly'], off: number, now: number): HourPoint[] {
  const times = h?.time ?? []
  const out: HourPoint[] = []
  for (let i = 0; i < times.length && out.length < FORECAST_HOURS; i++) {
    const at = localIsoToEpoch(times[i], off)
    const temp = h?.temperature_2m?.[i]
    if (at == null || temp == null || at + 3_600_000 <= now) continue
    out.push({
      at,
      temp: Math.round(temp),
      precip: Math.round(h?.precipitation_probability?.[i] ?? 0),
      code: h?.weather_code?.[i] ?? -1,
      uv: tenths(h?.uv_index?.[i]),
    })
  }
  return out
}

function parseDaily(d: NonNullable<ForecastJson['daily']>): DayPoint[] {
  const out: DayPoint[] = []
  const days = d.time ?? []
  for (let i = 0; i < days.length && out.length < FORECAST_DAYS; i++) {
    const hi = round(d.temperature_2m_max?.[i])
    const lo = round(d.temperature_2m_min?.[i])
    if (hi == null || lo == null) continue
    out.push({
      date: days[i],
      code: d.weather_code?.[i] ?? -1,
      hi,
      lo,
      precip: Math.round(d.precipitation_probability_max?.[i] ?? 0),
      uv: tenths(d.uv_index_max?.[i]),
    })
  }
  return out
}

export function parseForecast(json: ForecastJson, units: Units, now = Date.now()): Weather {
  const c = json.current
  if (!c || c.temperature_2m == null) throw new Error('forecast: no current conditions')
  const off = json.utc_offset_seconds ?? 0
  const d = json.daily ?? {}
  const code = c.weather_code ?? -1
  const hourly = parseHourly(json.hourly, off, now)
  const uv = tenths(d.uv_index_max?.[0])
  return {
    temp: Math.round(c.temperature_2m),
    feels: Math.round(c.apparent_temperature ?? c.temperature_2m),
    code,
    label: wmoToLabel(code),
    wind: Math.round(c.wind_speed_10m ?? 0),
    windUnit: units === 'F' ? 'MPH' : 'KM/H',
    windDir: round(c.wind_direction_10m),
    gusts: round(c.wind_gusts_10m),
    humidity: round(c.relative_humidity_2m),
    isDay: c.is_day !== 0,
    uv,
    uvNow: json.hourly?.uv_index && hourly.length ? hourly[0].uv : uv,
    hi: Math.round(d.temperature_2m_max?.[0] ?? c.temperature_2m),
    lo: Math.round(d.temperature_2m_min?.[0] ?? c.temperature_2m),
    units,
    sunrise: localIsoToEpoch(d.sunrise?.[0], off),
    sunset: localIsoToEpoch(d.sunset?.[0], off),
    sunriseNext: localIsoToEpoch(d.sunrise?.[1], off),
    sunsetNext: localIsoToEpoch(d.sunset?.[1], off),
    utcOffset: off,
    hourly,
    daily: parseDaily(d),
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
