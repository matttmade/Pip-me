import type { IconId } from './icons'

/** Pure geometry for POIs, waypoints and regions of interest. Coordinates are [lon, lat]. */

export type LngLat = [number, number]

export type Poi = {
  /** Stable-ish key: tile feature id, else name + rounded position. */
  key: string
  name: string
  cat: IconId
  lon: number
  lat: number
  /** OpenMapTiles class/subclass, for the detail card. */
  cls?: string
  subclass?: string
}

const R = 6_371_008.8
const rad = (d: number) => (d * Math.PI) / 180

/** Great-circle distance in metres. */
export function distanceM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1])
  const dLon = rad(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Initial bearing a → b, degrees clockwise from north (0-359). */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const φ1 = rad(a[1])
  const φ2 = rad(b[1])
  const Δλ = rad(b[0] - a[0])
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
export const compass = (deg: number) => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]

/** `85 M`, `850 M`, `1.2 KM`, `14 KM`. */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / (m < 100 ? 5 : 10)) * (m < 100 ? 5 : 10))} M`
  const km = m / 1000
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} KM`
}

/** `1.2 KM NE 045°` */
export function formatVector(from: LngLat, to: LngLat): string {
  const b = bearingDeg(from, to)
  return `${formatDistance(distanceM(from, to))} ${compass(b)} ${String(Math.round(b) % 360).padStart(3, '0')}°`
}

/** De-duplicate (tiles repeat features at their edges) and sort by distance from `from`. */
export function nearestPois(pois: Poi[], from: LngLat, n = 8): (Poi & { dist: number })[] {
  const seen = new Set<string>()
  const out: (Poi & { dist: number })[] = []
  for (const p of pois) {
    const k = `${p.name}|${p.cat}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ ...p, dist: distanceM(from, [p.lon, p.lat]) })
  }
  return out.sort((a, b) => a.dist - b.dist).slice(0, n)
}

/** Ray-casting point-in-ring. */
function inRing(pt: LngLat, ring: LngLat[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** GeoJSON Polygon / MultiPolygon coordinates (holes respected). */
export function pointInPolygon(pt: LngLat, geom: { type: string; coordinates: unknown }): boolean {
  const polys = (geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []) as LngLat[][][]
  return polys.some((rings) => rings.length > 0 && inRing(pt, rings[0]) && !rings.slice(1).some((h) => inRing(pt, h)))
}

export type PlacePoint = { name: string; cls: string; lon: number; lat: number }
export type NamedArea = { name: string; geometry: { type: string; coordinates: unknown } }

/** Place classes that name a part of a city, smallest first. */
const LOCAL = ['neighbourhood', 'quarter', 'suburb', 'hamlet', 'island']
const SETTLEMENT = ['village', 'town', 'city']
/** How far a neighbourhood label can be from the center and still claim it. */
export const LOCAL_RADIUS_M = 1600

/**
 * The region the map center is in: a named park/area that contains it, else the nearest
 * neighbourhood/suburb label within LOCAL_RADIUS_M, else the nearest settlement.
 */
export function pickRegion(center: LngLat, places: PlacePoint[], areas: NamedArea[] = []): string | null {
  const area = areas.find((a) => pointInPolygon(center, a.geometry))
  if (area) return area.name
  const near = (classes: string[], max: number) => {
    let best: PlacePoint | null = null
    let bestD = max
    for (const p of places) {
      if (!classes.includes(p.cls)) continue
      const d = distanceM(center, [p.lon, p.lat])
      if (d < bestD) {
        best = p
        bestD = d
      }
    }
    return best
  }
  return (near(LOCAL, LOCAL_RADIUS_M) ?? near(SETTLEMENT, Infinity))?.name ?? null
}
