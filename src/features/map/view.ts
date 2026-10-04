import type { Ref } from 'react'
import type { Poi } from './regions'

/** Imperative controls shared by PipMap (MapLibre) and LeafletFallback. */
export type MapHandle = {
  zoomIn(): void
  zoomOut(): void
  /** Fly to the player. */
  recenter(): void
  /** Pan to a location (NEARBY list). */
  flyTo?(lon: number, lat: number): void
}

export type MapViewProps = {
  ref?: Ref<MapHandle>
  lat: number
  lon: number
  hue: number
  /** Degrees clockwise from north, or null when unknown. */
  heading: number | null
  /** Keep the camera on the player as fixes arrive. */
  follow: boolean
  reducedMotion: boolean
  /** Bumped by the panel to fly the camera to the player (LOCATE, search pick, first fix). */
  centerSeq: number
  /** Called when this renderer can't work (no WebGL, style failed): switch to the fallback. */
  onFail?: (reason: string) => void
  /** Focused location (name shown on the map). Vector renderer only. */
  selected?: Poi | null
  /** Draw a dashed route from the player to this location. Vector renderer only. */
  waypoint?: Poi | null
  /** Tap/click on a location icon (or on empty map: null). */
  onSelect?: (poi: Poi | null) => void
  /** After the view settles: locations on screen and the region under the center. */
  onScan?: (scan: MapScan) => void
}

export type MapScan = { pois: Poi[]; region: string | null }

export const START_ZOOM = 14

/** WebGL check (maplibre-gl v3+ dropped maplibregl.supported()). */
export function webglSupported(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * CSS filter that turns light OSM raster tiles into Pip phosphor:
 * grayscale → invert (dark land, bright roads) → sepia (≈ hue 38°) → rotate to the Pip hue.
 */
export function leafletFilter(hue: number): string {
  const rotate = Math.round((((hue - 38) % 360) + 360) % 360)
  return `grayscale(1) invert(1) sepia(1) saturate(5) hue-rotate(${rotate}deg) brightness(0.85) contrast(1.15)`
}

/** Player chevron for either renderer. Rotation is applied via the --heading CSS var. */
export function createPlayerEl(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pip-player'
  el.setAttribute('aria-label', 'Your location')
  el.innerHTML =
    '<span class="pip-player__pulse"></span>' +
    '<svg class="pip-player__chevron" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' +
    '<path d="M12 2 L21 21 L12 16 L3 21 Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  return el
}

export function setPlayerHeading(el: HTMLElement, heading: number | null) {
  el.style.setProperty('--heading', `${heading ?? 0}deg`)
  el.classList.toggle('has-heading', heading != null)
}
