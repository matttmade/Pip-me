import { useEffect, useState } from 'react'
import { cachedPlaceName, coordKey, formatCoords, reverseGeocode } from './geo'
import type { UseLocation } from './useLocation'

/** `BOSTON, MA` for the current location: known label, cached lookup, or Nominatim. */
export function usePlaceName(loc: Pick<UseLocation, 'coords' | 'label'>): string {
  const { lat, lon } = loc.coords
  const key = coordKey(lat, lon)
  const [resolved, setResolved] = useState<{ key: string; name: string } | null>(null)

  useEffect(() => {
    if (loc.label) return
    let live = true
    // Debounce so FOLLOW's stream of fixes doesn't hammer Nominatim.
    const t = window.setTimeout(() => {
      reverseGeocode(lat, lon).then((name) => live && setResolved({ key, name }))
    }, 400)
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [lat, lon, key, loc.label])

  if (loc.label) return loc.label
  if (resolved?.key === key) return resolved.name
  return cachedPlaceName(lat, lon) ?? resolved?.name ?? formatCoords(lat, lon)
}
