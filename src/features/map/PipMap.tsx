import { Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// maplibre-gl v6 resolves its worker relative to its own module, which a bundle breaks:
// let Vite bundle the worker (with its shared chunk) and hand MapLibre the URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { iconImage } from './iconImages'
import { iconSvg } from './icons'
import {
  ACTIVE_ROI_SOURCE,
  huePaintUpdates,
  patternImages,
  pipMapStyle,
  POI_LAYERS,
  REGION_LABEL_LAYER,
  regionLabelColor,
  ROI_LANDUSE,
  WAYPOINT_SOURCE,
  type MapStyle,
} from './pipMapStyle'
import { featureToPoi, poiName } from './poi'
import { pickRegion, pointInPolygon, type LngLat, type NamedArea, type PlacePoint, type Poi } from './regions'
import { createPlayerEl, setPlayerHeading, START_ZOOM, type MapViewProps } from './view'

/** OpenFreeMap hosted style (https://openfreemap.org/quick_start/). */
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const LOAD_TIMEOUT = 15_000
const VECTOR = 'openmaptiles'
/** Touch-friendly hit box around a tap, px. */
const HIT = 14

setWorkerUrl(workerUrl)

let stylePromise: Promise<MapStyle> | null = null
function loadBaseStyle(): Promise<MapStyle> {
  stylePromise ??= fetch(STYLE_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`style ${r.status}`)
      return r.json() as Promise<MapStyle>
    })
    .catch((e) => {
      stylePromise = null // allow a retry next mount
      throw e
    })
  return stylePromise
}

const EMPTY = { type: 'FeatureCollection' as const, features: [] }

/** The focused location: a big glowing icon with its name beside it. */
function createFocusEl(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pip-focus'
  el.setAttribute('aria-hidden', 'true')
  return el
}
function paintFocus(el: HTMLElement, poi: Poi, hover: boolean) {
  el.innerHTML = `${iconSvg(poi.cat, 30, 'pip-focus__icon')}<span class="pip-focus__name"></span>`
  el.querySelector('.pip-focus__name')!.textContent = poi.name
  el.classList.toggle('is-hover', hover)
}

function drawWaypoint(map: MlMap, wp: Poi | null, lon: number, lat: number) {
  map.getSource<GeoJSONSource>(WAYPOINT_SOURCE)?.setData(
    wp
      ? {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [lon, lat],
              [wp.lon, wp.lat],
            ],
          },
        }
      : EMPTY,
  )
}

/** MapLibre + OpenFreeMap vector tiles, recolored into the Pip palette. */
export default function PipMap({
  ref,
  lat,
  lon,
  hue,
  heading,
  follow,
  reducedMotion,
  centerSeq,
  onFail,
  selected = null,
  waypoint = null,
  onSelect,
  onScan,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const focusRef = useRef<{ marker: Marker; el: HTMLElement } | null>(null)
  const baseStyle = useRef<MapStyle | null>(null)
  const loaded = useRef(false)
  const hovered = useRef<Poi | null>(null)
  const region = useRef<string | null>(null)
  const activeKey = useRef('')
  const latest = useRef({ lat, lon, hue, heading, follow, reducedMotion, onFail, selected, waypoint, onSelect, onScan })
  useLayoutEffect(() => {
    latest.current = { lat, lon, hue, heading, follow, reducedMotion, onFail, selected, waypoint, onSelect, onScan }
  })

  /** Show the hovered location, else the selected one. */
  const syncFocus = useRef(() => {})
  useLayoutEffect(() => {
    syncFocus.current = () => {
      const map = mapRef.current
      if (!map) return
      const poi = hovered.current ?? latest.current.selected
      if (!poi) {
        focusRef.current?.marker.remove()
        focusRef.current = null
        return
      }
      if (!focusRef.current) {
        const el = createFocusEl()
        focusRef.current = { el, marker: new Marker({ element: el, anchor: 'center' }) }
      }
      const { el, marker } = focusRef.current
      paintFocus(el, poi, poi === hovered.current && poi.key !== latest.current.selected?.key)
      marker.setLngLat([poi.lon, poi.lat]).addTo(map)
      // Keep the name on screen: put it on the left of icons in the right part of the map.
      el.classList.toggle('is-left', map.project([poi.lon, poi.lat]).x > map.getContainer().clientWidth * 0.55)
    }
  }, [])

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    let timer = 0
    const fail = (why: string) => !cancelled && latest.current.onFail?.(why)

    /** Region under the center + the on-screen locations. Runs when the map goes idle. */
    const scan = () => {
      if (!map) return
      const c = map.getCenter()
      const center: LngLat = [c.lng, c.lat]
      const layers = POI_LAYERS.filter((id) => map!.getLayer(id))
      const pois = map.queryRenderedFeatures({ layers }).map(featureToPoi).filter((p): p is Poi => !!p)

      const places: PlacePoint[] = []
      for (const f of map.querySourceFeatures(VECTOR, { sourceLayer: 'place' })) {
        const name = poiName(f.properties)
        const cls = f.properties?.class
        if (name && typeof cls === 'string' && f.geometry.type === 'Point') {
          const [x, y] = f.geometry.coordinates
          places.push({ name, cls, lon: x, lat: y })
        }
      }
      // Areas containing the center: named parks claim the region name; any ROI is highlighted.
      const areas: NamedArea[] = []
      const candidates = [
        ...map.querySourceFeatures(VECTOR, { sourceLayer: 'park' }).map((f) => Object.assign(f, { sourceLayer: 'park' })),
        ...map
          .querySourceFeatures(VECTOR, { sourceLayer: 'landuse', filter: ['match', ['get', 'class'], ROI_LANDUSE, true, false] })
          .map((f) => Object.assign(f, { sourceLayer: 'landuse' })),
      ]
      let active: (typeof candidates)[number] | null = null
      for (const f of candidates) {
        if (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon') continue
        if (!pointInPolygon(center, f.geometry)) continue
        active ??= f
        const name = poiName(f.properties)
        if (name && f.sourceLayer === 'park') areas.push({ name, geometry: f.geometry })
      }
      const name = pickRegion(center, places, areas)

      const key = active ? `${active.sourceLayer}:${active.id ?? JSON.stringify(active.geometry).slice(0, 80)}` : ''
      if (key !== activeKey.current) {
        activeKey.current = key
        const src = map.getSource<GeoJSONSource>(ACTIVE_ROI_SOURCE)
        src?.setData(active ? { type: 'Feature', properties: {}, geometry: active.geometry } : EMPTY)
      }
      if (name !== region.current) {
        region.current = name
        if (map.getLayer(REGION_LABEL_LAYER)) map.setPaintProperty(REGION_LABEL_LAYER, 'text-color', regionLabelColor(latest.current.hue, name) as never)
      }
      latest.current.onScan?.({ pois, region: name })
    }

    loadBaseStyle()
      .then((style) => {
        if (cancelled || !container.current) return
        baseStyle.current = style
        const { lat, lon, hue, reducedMotion } = latest.current
        try {
          map = new MlMap({
            container: container.current,
            style: pipMapStyle(style, hue) as unknown as StyleSpecification,
            center: [lon, lat],
            zoom: START_ZOOM,
            attributionControl: { compact: true },
            dragRotate: false,
            pitchWithRotate: false,
            maxPitch: 0,
            fadeDuration: reducedMotion ? 0 : 300,
          })
        } catch {
          return fail('webgl')
        }
        mapRef.current = map
        map.touchZoomRotate.disableRotation()
        map.keyboard.disable() // Q/E/A/D and arrows belong to the Pip-Boy shell
        map.on('styleimagemissing', (e) => {
          if (!map || map.hasImage(e.id)) return
          const pattern = patternImages(latest.current.hue)[e.id]
          if (pattern) return map.addImage(e.id, pattern)
          const icon = iconImage(e.id)
          if (icon) map.addImage(e.id, icon.image, icon.options)
        })
        map.on('load', () => {
          loaded.current = true
          window.clearTimeout(timer)
          const { waypoint, lon, lat } = latest.current
          drawWaypoint(map!, waypoint, lon, lat)
          syncFocus.current()
        })
        map.on('idle', scan)
        map.on('moveend', () => focusRef.current && syncFocus.current())
        map.on('webglcontextlost', () => fail('webgl'))
        timer = window.setTimeout(() => !loaded.current && fail('timeout'), LOAD_TIMEOUT)

        // Hover (mouse) shows a location's name; click/tap selects it.
        map.on('mousemove', [...POI_LAYERS], (e) => {
          const poi = e.features?.[0] ? featureToPoi(e.features[0]) : null
          if (poi?.key === hovered.current?.key) return
          hovered.current = poi
          map!.getCanvas().style.cursor = poi ? 'pointer' : ''
          syncFocus.current()
        })
        map.on('mouseleave', [...POI_LAYERS], () => {
          hovered.current = null
          map!.getCanvas().style.cursor = ''
          syncFocus.current()
        })
        map.on('click', (e) => {
          const layers = POI_LAYERS.filter((id) => map!.getLayer(id))
          const box: [[number, number], [number, number]] = [
            [e.point.x - HIT, e.point.y - HIT],
            [e.point.x + HIT, e.point.y + HIT],
          ]
          const hits = map!.queryRenderedFeatures(box, { layers })
          // Nearest icon to the tap wins.
          let best: Poi | null = null
          let bestD = Infinity
          for (const f of hits) {
            const poi = featureToPoi(f)
            if (!poi) continue
            const pt = map!.project([poi.lon, poi.lat])
            const d = Math.hypot(pt.x - e.point.x, pt.y - e.point.y)
            if (d < bestD) {
              best = poi
              bestD = d
            }
          }
          hovered.current = null
          latest.current.onSelect?.(best)
        })

        const el = createPlayerEl()
        setPlayerHeading(el, latest.current.heading)
        markerRef.current = new Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
      })
      .catch(() => fail('style'))

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      markerRef.current?.remove()
      focusRef.current?.marker.remove()
      map?.remove()
      mapRef.current = null
      markerRef.current = null
      focusRef.current = null
      loaded.current = false
    }
  }, [])

  // Hue change: repaint in place (no setStyle, so no tile re-download).
  useEffect(() => {
    const map = mapRef.current
    const style = baseStyle.current
    if (!map || !style) return
    const apply = () => {
      for (const u of huePaintUpdates(style, hue, { activeRegion: region.current })) {
        try {
          map.setPaintProperty(u.id, u.prop as Parameters<MlMap['setPaintProperty']>[1], u.value as never)
        } catch {
          // layer missing in this style version: skip
        }
      }
      for (const [id, px] of Object.entries(patternImages(hue))) if (map.hasImage(id)) map.updateImage(id, px)
    }
    if (loaded.current) apply()
    else map.once('load', apply)
  }, [hue])

  // Selection → focus label.
  useEffect(() => {
    syncFocus.current()
  }, [selected])

  // Waypoint: dashed line from the player to the target.
  useEffect(() => {
    const map = mapRef.current
    if (map && loaded.current) drawWaypoint(map, waypoint, lon, lat)
  }, [waypoint, lat, lon])

  // Player position, and camera when following.
  useEffect(() => {
    markerRef.current?.setLngLat([lon, lat])
    const map = mapRef.current
    if (map && follow) {
      if (reducedMotion) map.jumpTo({ center: [lon, lat] })
      else map.easeTo({ center: [lon, lat], duration: 600 })
    }
  }, [lat, lon, follow, reducedMotion])

  // Explicit recenter requests (LOCATE, search pick, first GPS fix).
  const lastSeq = useRef(centerSeq)
  useEffect(() => {
    if (lastSeq.current === centerSeq) return
    lastSeq.current = centerSeq
    const map = mapRef.current
    const { lat, lon, reducedMotion } = latest.current
    if (!map) return
    const zoom = Math.max(map.getZoom(), START_ZOOM - 1)
    if (reducedMotion) map.jumpTo({ center: [lon, lat], zoom })
    else map.flyTo({ center: [lon, lat], zoom, speed: 1.6 })
  }, [centerSeq])

  useEffect(() => {
    const el = markerRef.current?.getElement()
    if (el) setPlayerHeading(el, heading)
  }, [heading])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn({ animate: !latest.current.reducedMotion }),
      zoomOut: () => mapRef.current?.zoomOut({ animate: !latest.current.reducedMotion }),
      recenter: () => {
        const { lat, lon } = latest.current
        mapRef.current?.flyTo({ center: [lon, lat], animate: !latest.current.reducedMotion })
      },
      flyTo: (lon: number, lat: number) => mapRef.current?.easeTo({ center: [lon, lat], duration: latest.current.reducedMotion ? 0 : 500 }),
    }),
    [],
  )

  return <div ref={container} className="map-canvas" />
}
