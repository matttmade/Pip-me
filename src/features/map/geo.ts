import { readStored, writeStored } from '../../lib/store'

export type LatLon = { lat: number; lon: number }
export type Place = LatLon & { label: string }

export const DEFAULT_PLACE: Place = { lat: 42.3601, lon: -71.0589, label: 'THE COMMONWEALTH' }

/** `42.36°N 71.06°W` */
export function formatCoords(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S'
  const ew = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`
}

/** Cache key: coordinates rounded to 3 decimals (~110 m). */
export const coordKey = (lat: number, lon: number) => `${lat.toFixed(3)},${lon.toFixed(3)}`

type NominatimAddress = Partial<
  Record<'city' | 'town' | 'village' | 'hamlet' | 'municipality' | 'suburb' | 'county' | 'state' | 'country' | 'ISO3166-2-lvl4' | 'country_code', string>
>

/** Nominatim reverse result → `BOSTON, MA` (state code when available). Null if nothing usable. */
export function formatNominatim(json: { address?: NominatimAddress; name?: string } | null | undefined): string | null {
  const a = json?.address
  if (!a) return json?.name ? json.name.toUpperCase() : null
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? a.suburb ?? a.county ?? json?.name
  const iso = a['ISO3166-2-lvl4']
  const isoCode = iso?.includes('-') ? iso.split('-')[1] : undefined
  const region = isoCode && /^[A-Z]{1,3}$/.test(isoCode) ? isoCode : (a.state ?? a.country)
  const parts = [city, region].filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i)
  return parts.length ? parts.join(', ').toUpperCase() : null
}

export type GeoSearchResult = { name: string; latitude: number; longitude: number; admin1?: string; country?: string; country_code?: string }

/** Open-Meteo geocoding result → Place. */
export function toPlace(r: GeoSearchResult): Place {
  const region = r.admin1 && r.admin1 !== r.name ? r.admin1 : r.country
  return { lat: r.latitude, lon: r.longitude, label: [r.name, region].filter(Boolean).join(', ').toUpperCase() }
}

export async function searchPlaces(q: string, signal?: AbortSignal): Promise<(Place & { detail: string })[]> {
  const query = q.trim()
  if (query.length < 2) return []
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`, { signal })
  if (!res.ok) throw new Error(`geocoding ${res.status}`)
  const json = (await res.json()) as { results?: GeoSearchResult[] }
  return (json.results ?? []).map((r) => ({ ...toPlace(r), detail: [r.admin1, r.country].filter(Boolean).join(', ').toUpperCase() }))
}

// ---- reverse geocode (Nominatim: max 1 request / second) ----

const CACHE_KEY = 'geo:reverse'
const inflight = new Map<string, Promise<string>>()
let nextSlot = 0
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Throttle gate: resolves when it's this caller's turn (≥1.1 s apart). */
async function slot(): Promise<void> {
  const now = Date.now()
  const at = Math.max(now, nextSlot)
  nextSlot = at + 1100
  if (at > now) await sleep(at - now)
}

export function cachedPlaceName(lat: number, lon: number): string | undefined {
  return readStored<Record<string, string>>(CACHE_KEY, {})[coordKey(lat, lon)]
}

/** `BOSTON, MA` for a coordinate; falls back to formatted coordinates on any failure. */
export function reverseGeocode(lat: number, lon: number): Promise<string> {
  const key = coordKey(lat, lon)
  const hit = cachedPlaceName(lat, lon)
  if (hit) return Promise.resolve(hit)
  const pending = inflight.get(key)
  if (pending) return pending
  const p = (async () => {
    try {
      await slot()
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&zoom=10&accept-language=en`,
      )
      if (!res.ok) throw new Error(`nominatim ${res.status}`)
      const name = formatNominatim(await res.json())
      if (!name) throw new Error('no name')
      writeStored<Record<string, string>>(CACHE_KEY, (prev) => ({ ...prev, [key]: name }), {})
      return name
    } catch {
      return formatCoords(lat, lon)
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}
