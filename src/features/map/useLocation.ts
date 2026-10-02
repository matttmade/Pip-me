import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { emit } from '../../lib/events'
import { usePageVisible } from '../../lib/hooks'
import { readStored, useStored, writeStored } from '../../lib/store'
import { DEFAULT_PLACE, type LatLon, type Place } from './geo'

export type LocationSource = 'gps' | 'search' | 'default'
export type LocationStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'timeout' | 'unavailable' | 'unsupported'

type StoredLocation = { lat: number; lon: number; label?: string; source: 'gps' | 'search'; at: number }

const LOC_KEY = 'map:location'
const FOLLOW_KEY = 'map:follow'
const GPS_TIMEOUT = 8000

// ---- transient (not persisted) state shared by every useLocation() caller ----
type Live = { status: LocationStatus; heading: number | null; accuracy: number | null }
let live: Live = { status: 'idle', heading: null, accuracy: null }
const liveListeners = new Set<() => void>()
const setLive = (patch: Partial<Live>) => {
  live = { ...live, ...patch }
  liveListeners.forEach((fn) => fn())
}
const subscribeLive = (fn: () => void) => (liveListeners.add(fn), () => liveListeners.delete(fn))

const geo = () => (typeof navigator !== 'undefined' && 'geolocation' in navigator ? navigator.geolocation : null)

function onFix(pos: GeolocationPosition) {
  const { latitude: lat, longitude: lon, heading, accuracy } = pos.coords
  const first = live.status !== 'ok'
  writeStored<StoredLocation | null>(LOC_KEY, { lat, lon, source: 'gps', at: Date.now() }, null)
  setLive({ status: 'ok', heading: heading != null && !Number.isNaN(heading) ? heading : live.heading, accuracy })
  if (first) emit({ type: 'map-located' })
}

function onError(err: GeolocationPositionError) {
  const status: LocationStatus = err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'
  // A watch error after a good fix keeps the last position.
  setLive({ status: live.status === 'ok' && status !== 'denied' ? 'ok' : status })
}

/** One-shot GPS fix. */
export function requestFix(): void {
  const g = geo()
  if (!g) return setLive({ status: 'unsupported' })
  setLive({ status: 'locating' })
  g.getCurrentPosition(onFix, onError, { enableHighAccuracy: true, timeout: GPS_TIMEOUT, maximumAge: 30_000 })
}

// ---- FOLLOW: one shared watchPosition, ref-counted across callers ----
let watchId: number | null = null
let watchers = 0
function acquireWatch(): () => void {
  const g = geo()
  if (!g) return () => {}
  watchers++
  if (watchId == null) {
    watchId = g.watchPosition(onFix, onError, { enableHighAccuracy: true, timeout: GPS_TIMEOUT * 2, maximumAge: 5000 })
  }
  return () => {
    watchers--
    if (watchers <= 0 && watchId != null) {
      g.clearWatch(watchId)
      watchId = null
      watchers = 0
    }
  }
}

let autoRequested = false

export type UseLocation = {
  coords: LatLon
  /** Label known without a lookup (search pick or default); GPS fixes need reverseGeocode. */
  label?: string
  source: LocationSource
  status: LocationStatus
  heading: number | null
  accuracy: number | null
  request(): void
  setManual(place: Place): void
  follow: boolean
  setFollow(on: boolean): void
}

/**
 * Where the dweller is. GPS (8 s timeout) → stored override/last fix → Boston.
 * `auto` asks for a GPS fix once per session on mount (unless the user picked a city).
 * Status-bar consumers pass auto=false so the permission prompt only appears on MAP/STATS.
 */
export function useLocation({ auto = false }: { auto?: boolean } = {}): UseLocation {
  const [stored, setStored] = useStored<StoredLocation | null>(LOC_KEY, null)
  const [follow, setFollowStored] = useStored<boolean>(FOLLOW_KEY, false)
  const state = useSyncExternalStore(subscribeLive, () => live, () => live)
  const visible = usePageVisible()

  useEffect(() => {
    if (!auto || autoRequested) return
    autoRequested = true
    const s = readStored<StoredLocation | null>(LOC_KEY, null)
    if (s?.source !== 'search') requestFix()
  }, [auto])

  useEffect(() => {
    if (!auto || !follow || !visible) return
    return acquireWatch()
  }, [auto, follow, visible])

  const setManual = useCallback(
    (place: Place) => {
      setStored({ lat: place.lat, lon: place.lon, label: place.label, source: 'search', at: Date.now() })
      setFollowStored(false)
      setLive({ status: 'idle', heading: null, accuracy: null })
    },
    [setStored, setFollowStored],
  )
  const setFollow = useCallback(
    (on: boolean) => {
      setFollowStored(on)
      if (on) requestFix()
    },
    [setFollowStored],
  )

  const coords = stored ? { lat: stored.lat, lon: stored.lon } : { lat: DEFAULT_PLACE.lat, lon: DEFAULT_PLACE.lon }
  return {
    coords,
    label: stored ? stored.label : DEFAULT_PLACE.label,
    source: stored?.source ?? 'default',
    status: state.status,
    heading: state.heading,
    accuracy: state.accuracy,
    request: requestFix,
    setManual,
    follow,
    setFollow,
  }
}
