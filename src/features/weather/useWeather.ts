import { useEffect, useSyncExternalStore } from 'react'
import { usePageVisible } from '../../lib/hooks'
import { useSettings } from '../../lib/profile'
import { readStored, writeStored } from '../../lib/store'
import { getWeather, type Units, type Weather } from './openMeteo'

export const REFRESH_MS = 15 * 60_000
const CACHE_KEY = 'weather:v2'

type Cached = { key: string; data: Weather } | null
type State = { key: string; data: Weather | null; status: 'idle' | 'loading' | 'ok' | 'error' }

const keyOf = (lat: number, lon: number, units: Units) => `${lat.toFixed(2)},${lon.toFixed(2)}|${units}`

let state: State | null = null
const listeners = new Set<() => void>()
const inflight = new Map<string, Promise<void>>()

function current(): State {
  if (!state) {
    const c = readStored<Cached>(CACHE_KEY, null)
    state = c ? { key: c.key, data: c.data, status: 'ok' } : { key: '', data: null, status: 'idle' }
  }
  return state
}
function set(next: State) {
  state = next
  listeners.forEach((fn) => fn())
}
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn))

function load(lat: number, lon: number, units: Units): Promise<void> {
  const key = keyOf(lat, lon, units)
  const pending = inflight.get(key)
  if (pending) return pending
  const prev = current()
  set({ key, data: prev.key === key ? prev.data : null, status: 'loading' })
  const p = getWeather(lat, lon, units)
    .then((data) => {
      writeStored<Cached>(CACHE_KEY, { key, data }, null)
      if (current().key === key) set({ key, data, status: 'ok' })
    })
    .catch(() => {
      const s = current()
      if (s.key === key) set({ ...s, status: 'error' })
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

const isStale = (s: State, key: string) => s.key !== key || !s.data || Date.now() - s.data.fetchedAt > REFRESH_MS

/**
 * Open-Meteo conditions for a coordinate, shared by every caller.
 * Refreshes every 15 min while the page is visible; last result cached in session.
 */
export function useWeather(lat: number, lon: number): { weather: Weather | null; status: State['status'] } {
  const [settings] = useSettings()
  const units = settings.units
  const s = useSyncExternalStore(subscribe, current, current)
  const visible = usePageVisible()
  const key = keyOf(lat, lon, units)

  useEffect(() => {
    if (!visible) return
    const tick = () => {
      // Checked every minute: refetches when stale (15 min), or retries after an error.
      if (isStale(current(), key)) void load(lat, lon, units)
    }
    tick()
    const t = window.setInterval(tick, 60_000)
    return () => window.clearInterval(t)
  }, [visible, key, lat, lon, units])

  const match = s.key === key
  return { weather: match ? s.data : null, status: match ? s.status : 'loading' }
}
