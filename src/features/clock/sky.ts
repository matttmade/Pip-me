/** Sky math for DATA > STATS: moon phase, sun countdowns, golden hour, compass points. Pure. */

export const SYNODIC_DAYS = 29.530588853
/** A reference new moon: 2000-01-06 18:14 UTC. */
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14)
const DAY = 86_400_000

export type MoonPhase = {
  /** 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter. */
  fraction: number
  /** Days since the last new moon. */
  age: number
  /** Lit share of the disc, 0-1. */
  illumination: number
  name: string
  /** Whole days until the next full moon (0 = tonight). */
  daysToFull: number
}

const PHASES: [number, string][] = [
  [0.0339, 'NEW MOON'],
  [0.216, 'WAXING CRESCENT'],
  [0.284, 'FIRST QUARTER'],
  [0.466, 'WAXING GIBBOUS'],
  [0.534, 'FULL MOON'],
  [0.716, 'WANING GIBBOUS'],
  [0.784, 'LAST QUARTER'],
  [0.9661, 'WANING CRESCENT'],
  [1, 'NEW MOON'],
]

export function moonPhase(epoch: number): MoonPhase {
  const age = ((((epoch - NEW_MOON_REF) / DAY) % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS
  const fraction = age / SYNODIC_DAYS
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2
  const name = PHASES.find(([edge]) => fraction < edge)?.[1] ?? 'NEW MOON'
  const daysToFull = Math.round((((0.5 - fraction + 1) % 1) * SYNODIC_DAYS) % SYNODIC_DAYS)
  return { fraction, age, illumination, name, daysToFull }
}

export type PhaseMark = { name: 'NEW' | 'FIRST Q' | 'FULL' | 'LAST Q'; fraction: number; at: number }
const MARKS: [PhaseMark['name'], number][] = [
  ['NEW', 0],
  ['FIRST Q', 0.25],
  ['FULL', 0.5],
  ['LAST Q', 0.75],
]

/** The next new / first-quarter / full / last-quarter moments after `now`, soonest first. */
export function nextPhases(now: number): PhaseMark[] {
  const f = moonPhase(now).fraction
  return MARKS.map(([name, target]) => {
    let ahead = (((target - f) % 1) + 1) % 1
    if (ahead < 1e-6) ahead = 1
    return { name, fraction: target, at: Math.round(now + ahead * SYNODIC_DAYS * DAY) }
  }).sort((a, b) => a.at - b.at)
}

/**
 * SVG path (centred on 0,0, radius r) of the lit part of the moon as seen from the
 * northern hemisphere: waxing lights the right limb, waning the left. Empty at new moon.
 */
export function moonPath(fraction: number, r: number): string {
  const f = ((fraction % 1) + 1) % 1
  const k = Math.cos(2 * Math.PI * f) // 1 new → -1 full
  if (k > 0.999) return ''
  const rx = +(r * Math.abs(k)).toFixed(3)
  const waxing = f <= 0.5
  const crescent = k > 0
  const outer = waxing ? 1 : 0
  const term = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0
  return `M0 ${-r}A${r} ${r} 0 0 ${outer} 0 ${r}A${rx} ${r} 0 0 ${term} 0 ${-r}Z`
}

export type SunTimes = { sunrise: number | null; sunset: number | null; sunriseNext?: number | null }
export type SunEvent = { kind: 'SUNRISE' | 'SUNSET'; at: number; ms: number }

/** The next sunrise or sunset after `now`, or null when sun times are unknown. */
export function nextSunEvent(now: number, s: SunTimes): SunEvent | null {
  const { sunrise, sunset } = s
  if (sunrise == null || sunset == null) return null
  if (now < sunrise) return { kind: 'SUNRISE', at: sunrise, ms: sunrise - now }
  if (now < sunset) return { kind: 'SUNSET', at: sunset, ms: sunset - now }
  const next = s.sunriseNext ?? sunrise + DAY
  return next > now ? { kind: 'SUNRISE', at: next, ms: next - now } : null
}

/** 8_040_000 → `2H 14M`; under an hour `14M`; under a minute `<1M`. */
export function formatCountdown(ms: number): string {
  if (ms < 60_000) return '<1M'
  const min = Math.floor(ms / 60_000)
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}H ${String(m).padStart(2, '0')}M` : `${m}M`
}

/** 3_725_000 → `1:02:05`; under an hour `02:05`. A ticking duration. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export const GOLDEN_MS = 60 * 60_000

/** Golden-hour windows (about an hour after sunrise and before sunset) and whether `now` is in one. */
export function goldenHour(now: number, sunrise: number | null, sunset: number | null) {
  if (sunrise == null || sunset == null) return null
  const morning = { start: sunrise, end: sunrise + GOLDEN_MS }
  const evening = { start: sunset - GOLDEN_MS, end: sunset }
  const active = now >= morning.start && now < morning.end ? 'MORNING' : now >= evening.start && now < evening.end ? 'EVENING' : null
  return { morning, evening, active: active as 'MORNING' | 'EVENING' | null }
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']

/** 225 → `SW` (16-point compass). */
export function compassPoint(deg: number): string {
  const d = ((deg % 360) + 360) % 360
  return POINTS[Math.round(d / 22.5) % 16]
}
