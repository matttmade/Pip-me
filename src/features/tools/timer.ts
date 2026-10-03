/**
 * Pure timer math. All times are epoch ms; `now` is always passed in, so the
 * state is plain JSON that survives a reload and every function is testable.
 */

/** A countdown that can be paused. `banked` is time already run before `startedAt`. */
export type Countdown = { duration: number; startedAt: number | null; banked: number }
export type TimerStatus = 'idle' | 'running' | 'paused' | 'done'

export const countdown = (duration: number): Countdown => ({ duration, startedAt: null, banked: 0 })

export const elapsedOf = (c: { startedAt: number | null; banked: number }, now: number) =>
  c.banked + (c.startedAt != null ? Math.max(0, now - c.startedAt) : 0)

export const remainingOf = (c: Countdown, now: number) => Math.max(0, c.duration - elapsedOf(c, now))

export function statusOf(c: Countdown, now: number): TimerStatus {
  if (remainingOf(c, now) <= 0) return 'done'
  if (c.startedAt != null) return 'running'
  return c.banked > 0 ? 'paused' : 'idle'
}

/** True when a running countdown has reached zero and its alarm has not been handled yet. */
export const isDue = (c: Countdown, now: number) => c.startedAt != null && remainingOf(c, now) <= 0

export function startCountdown(c: Countdown, now: number): Countdown {
  if (c.startedAt != null) return c
  if (remainingOf(c, now) <= 0) return { ...c, banked: 0, startedAt: now }
  return { ...c, startedAt: now }
}

export function pauseCountdown(c: Countdown, now: number): Countdown {
  if (c.startedAt == null) return c
  return { ...c, banked: Math.min(c.duration, elapsedOf(c, now)), startedAt: null }
}

export const resetCountdown = (c: Countdown): Countdown => countdown(c.duration)

/** Marks a due countdown as finished so it never fires twice. */
export const finishCountdown = (c: Countdown): Countdown => ({ ...c, startedAt: null, banked: c.duration })

export const progressOf = (c: Countdown, now: number) => (c.duration > 0 ? Math.min(1, elapsedOf(c, now) / c.duration) : 1)

/* ---------- FOCUS STIM: a pomodoro cycle ---------- */

export type FocusPhase = 'focus' | 'break'
export type Focus = { phase: FocusPhase; focusMin: number; breakMin: number; sessions: number; timer: Countdown }

export const MIN = 60_000

export const newFocus = (focusMin = 25, breakMin = 5): Focus => ({
  phase: 'focus',
  focusMin,
  breakMin,
  sessions: 0,
  timer: countdown(focusMin * MIN),
})

/** After a phase runs out: a finished focus session counts, then the other phase is loaded (not started). */
export function completeFocus(f: Focus): Focus {
  const phase: FocusPhase = f.phase === 'focus' ? 'break' : 'focus'
  return {
    ...f,
    phase,
    sessions: f.phase === 'focus' ? f.sessions + 1 : f.sessions,
    timer: countdown((phase === 'focus' ? f.focusMin : f.breakMin) * MIN),
  }
}

/** Change a phase length; the current timer only follows if it has not started. */
export function setFocusLength(f: Focus, which: FocusPhase, minutes: number, now: number): Focus {
  const next = { ...f, [which === 'focus' ? 'focusMin' : 'breakMin']: minutes }
  if (which === f.phase && statusOf(f.timer, now) === 'idle') next.timer = countdown(minutes * MIN)
  return next
}

/** Skip to the other phase without counting a session. */
export const switchFocusPhase = (f: Focus): Focus => {
  const phase: FocusPhase = f.phase === 'focus' ? 'break' : 'focus'
  return { ...f, phase, timer: countdown((phase === 'focus' ? f.focusMin : f.breakMin) * MIN) }
}

/* ---------- STOPWATCH ---------- */

export type Stopwatch = { startedAt: number | null; banked: number; laps: number[] }
export const newStopwatch = (): Stopwatch => ({ startedAt: null, banked: 0, laps: [] })

export const startStopwatch = (s: Stopwatch, now: number): Stopwatch => (s.startedAt != null ? s : { ...s, startedAt: now })
export const pauseStopwatch = (s: Stopwatch, now: number): Stopwatch =>
  s.startedAt == null ? s : { ...s, banked: elapsedOf(s, now), startedAt: null }
export const MAX_LAPS = 99
/** Laps are stored as total elapsed at the split; newest last. */
export const lapStopwatch = (s: Stopwatch, now: number): Stopwatch =>
  s.startedAt == null || s.laps.length >= MAX_LAPS ? s : { ...s, laps: [...s.laps, elapsedOf(s, now)] }

/** Per-lap durations from the cumulative splits. */
export const lapDurations = (laps: number[]) => laps.map((t, i) => t - (laps[i - 1] ?? 0))

/* ---------- formatting ---------- */

const p2 = (n: number) => String(n).padStart(2, '0')

/** Countdown display: whole seconds rounded up, so it reads 00:01 until it really hits zero. */
export function fmtCountdown(ms: number): string {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${p2(m)}:${p2(s % 60)}` : `${p2(m)}:${p2(s % 60)}`
}

/** Stopwatch display with hundredths: MM:SS.cc (H:MM:SS.cc past an hour). */
export function fmtStopwatch(ms: number): string {
  const cs = Math.floor(Math.max(0, ms) / 10)
  const s = Math.floor(cs / 100)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const base = `${p2(m)}:${p2(s % 60)}.${p2(cs % 100)}`
  return h ? `${h}:${base}` : base
}

/** Parse "MM:SS", "H:MM:SS", "90" (seconds) or "5m" / "90s" / "1.5h" into ms; null when invalid, zero or over 24h. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase()
  if (!t) return null
  let ms: number
  const unit = /^(\d+(?:\.\d+)?)\s*(h|m|s)$/.exec(t)
  if (unit) {
    ms = Number(unit[1]) * (unit[2] === 'h' ? 3600_000 : unit[2] === 'm' ? MIN : 1000)
  } else if (/^\d+(:\d{1,2}){0,2}$/.test(t)) {
    const parts = t.split(':').map(Number)
    if (parts.slice(1).some((n) => n >= 60)) return null
    ms = parts.reduce((acc, n) => acc * 60 + n, 0) * 1000
  } else return null
  ms = Math.round(ms)
  return ms > 0 && ms <= 24 * 3600_000 ? ms : null
}
