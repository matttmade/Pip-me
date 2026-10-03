import { useEffect, useState } from 'react'

/** Current time, ticking every `intervalMs` (default 15s). */
export function useClock(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(t)
  }, [intervalMs])
  return now
}
