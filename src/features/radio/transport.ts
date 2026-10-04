/** Pure transport math for the streamed station (times in milliseconds). */

export const SKIP_MS = 30_000
const DAY_MS = 86_400_000

export const clamp = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo)

/**
 * ms → "m:ss", or "h:mm:ss" when the time (or the reference total) reaches an hour,
 * so elapsed and total line up: "0:02:13 / 2:35:04".
 */
export function formatHMS(ms: number, totalMs = 0): string {
  const s = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 || totalMs >= 3_600_000 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Screen-reader text for the seek slider: "1:02:13 of 2:35:04". */
export const seekText = (pos: number, duration: number) =>
  duration > 0 ? `${formatHMS(pos, duration)} of ${formatHMS(duration, duration)}` : 'Unknown length'

/** Milliseconds since local midnight. */
export const msOfDay = (d: Date) => ((d.getHours() * 60 + d.getMinutes()) * 60 + d.getSeconds()) * 1000 + d.getMilliseconds()

/**
 * Pseudo-live start: where the "broadcast" would be if the track had looped since midnight.
 * Everyone tuning in at the same wall-clock time hears the same spot.
 */
export function liveOffset(dayMs: number, duration: number): number {
  if (!(duration > 0)) return 0
  const t = ((dayMs % DAY_MS) + DAY_MS) % DAY_MS
  return Math.floor(t % duration)
}

/** Position after skipping by delta, kept inside the track. */
export const skipBy = (pos: number, delta: number, duration: number) => clamp(pos + delta, 0, Math.max(0, duration))

/** 0-1 progress (0 when the length is unknown). */
export const progress = (pos: number, duration: number) => (duration > 0 ? clamp(pos / duration, 0, 1) : 0)

/** Pointer x over a bar of [left, left + width] → track position. */
export function positionAt(clientX: number, left: number, width: number, duration: number): number {
  if (!(width > 0) || !(duration > 0)) return 0
  return Math.round(clamp((clientX - left) / width, 0, 1) * duration)
}

/** Slider keys → new position, or null when the key isn't a seek key. */
export function seekForKey(key: string, pos: number, duration: number): number | null {
  const step: Record<string, number> = {
    ArrowRight: 10_000,
    ArrowUp: 10_000,
    ArrowLeft: -10_000,
    ArrowDown: -10_000,
    PageUp: 60_000,
    PageDown: -60_000,
  }
  if (key === 'Home') return 0
  if (key === 'End') return Math.max(0, duration - 1000)
  return key in step ? skipBy(pos, step[key], duration) : null
}
