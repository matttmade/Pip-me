import { useEffect } from 'react'
import { useLocation } from '../map/useLocation'
import { useWeather } from '../weather/useWeather'
import { startSessionTracking } from './sessionTracker'
import { daylight } from './time'
import { useClock } from './useClock'

/** AP in the status bar: minutes of daylight left today / total daylight minutes. */
export function useDaylight(): { remaining: number; total: number } {
  const { coords } = useLocation()
  const { weather } = useWeather(coords.lat, coords.lon)
  const now = useClock(60_000)
  // The status bar is always mounted, so the SESSION LOG counts from boot.
  useEffect(startSessionTracking, [])
  const d = daylight(now.getTime(), weather?.sunrise, weather?.sunset)
  return { remaining: d.remaining, total: d.total }
}
