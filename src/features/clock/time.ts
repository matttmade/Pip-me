const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']

export const WASTELAND_OFFSET = 261

/** `OCT 02, 2026` (local time). */
export function formatDate(d: Date, year = d.getFullYear()): string {
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${year}`
}

/** The same day, 261 years on: 2026 → 2287. `OCT 02, 2287`. */
export function wastelandDate(d: Date): string {
  return formatDate(d, d.getFullYear() + WASTELAND_OFFSET)
}

export const weekday = (d: Date) => DAYS[d.getDay()]

/** `09:41` + `AM`, 12-hour. */
export function clockParts(d: Date): { hm: string; ampm: 'AM' | 'PM'; seconds: string } {
  const h = d.getHours()
  return {
    hm: `${String(h % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    ampm: h < 12 ? 'AM' : 'PM',
    seconds: String(d.getSeconds()).padStart(2, '0'),
  }
}

/**
 * Daylight math (all epoch ms). remaining/total in minutes, progress 0-1 through the day
 * (0 before sunrise, 1 after sunset). Unknown sun times → zeros.
 */
export function daylight(now: number, sunrise: number | null | undefined, sunset: number | null | undefined) {
  if (sunrise == null || sunset == null || sunset <= sunrise) return { remaining: 0, total: 0, progress: 0, isDay: false }
  const total = Math.round((sunset - sunrise) / 60_000)
  const remaining = Math.round(Math.min(Math.max(sunset - Math.max(now, sunrise), 0), sunset - sunrise) / 60_000)
  const progress = Math.min(Math.max((now - sunrise) / (sunset - sunrise), 0), 1)
  return { remaining, total, progress, isDay: now >= sunrise && now < sunset }
}

/** 250 → `4H 10M` */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h}H ${String(m).padStart(2, '0')}M` : `${m}M`
}
