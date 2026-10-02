/** Daily hack streak (shown as CAPS). Dates are local YYYY-MM-DD keys. */
export type Streak = { count: number; lastDate: string | null }

export const EMPTY_STREAK: Streak = { count: 0, lastDate: null }

/** The calendar day before a YYYY-MM-DD key. */
export function prevDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d - 1))
  return t.toISOString().slice(0, 10)
}

/** Record a daily success on `date`: +1 after yesterday, restart at 1 after a gap, no-op if already counted. */
export function updateStreak(prev: Streak, date: string): Streak {
  if (prev.lastDate === date) return prev
  if (prev.lastDate === prevDay(date)) return { count: prev.count + 1, lastDate: date }
  return { count: 1, lastDate: date }
}

/** The streak as of `today`: it lapses to 0 once a whole day was skipped. */
export function currentStreak(s: Streak, today: string): number {
  if (!s.lastDate) return 0
  return s.lastDate === today || s.lastDate === prevDay(today) ? s.count : 0
}
