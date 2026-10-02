import { Map as MlMap, Marker, setWorkerUrl, type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// maplibre-gl v6 resolves its worker relative to its own module, which a bundle breaks:
// let Vite bundle the worker (with its shared chunk) and hand MapLibre the URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { HATCH_ID, hatchPixels, huePaintUpdates, pipMapStyle, type MapStyle } from './pipMapStyle'
import { createPlayerEl, setPlayerHeading, START_ZOOM, type MapViewProps } from './view'

/** OpenFreeMap hosted style (https://openfreemap.org/quick_start/). */
export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const LOAD_TIMEOUT = 15_000

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

/** MapLibre + OpenFreeMap vector tiles, recolored into the Pip palette. */
export default function PipMap({ ref, lat, lon, hue, heading, follow, reducedMotion, centerSeq, onFail }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const baseStyle = useRef<MapStyle | null>(null)
  const loaded = useRef(false)
  const latest = useRef({ lat, lon, hue, heading, follow, reducedMotion, onFail })
  useLayoutEffect(() => {
    latest.current = { lat, lon, hue, heading, follow, reducedMotion, onFail }
  })

  // Create the map once.
  useEffect(() => {
    let cancelled = false
    let map: MlMap | null = null
    let timer = 0
    const fail = (why: string) => !cancelled && latest.current.onFail?.(why)

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
          if (e.id === HATCH_ID && map && !map.hasImage(HATCH_ID)) map.addImage(HATCH_ID, hatchPixels(latest.current.hue))
        })
        map.on('load', () => {
          loaded.current = true
          window.clearTimeout(timer)
        })
        map.on('webglcontextlost', () => fail('webgl'))
        timer = window.setTimeout(() => !loaded.current && fail('timeout'), LOAD_TIMEOUT)

        const el = createPlayerEl()
        setPlayerHeading(el, latest.current.heading)
        markerRef.current = new Marker({ element: el }).setLngLat([lon, lat]).addTo(map)
      })
      .catch(() => fail('style'))

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      markerRef.current?.remove()
      map?.remove()
      mapRef.current = null
      markerRef.current = null
      loaded.current = false
    }
  }, [])

  // Hue change: repaint in place (no setStyle, so no tile re-download).
  useEffect(() => {
    const map = mapRef.current
    const style = baseStyle.current
    if (!map || !style) return
    const apply = () => {
      for (const u of huePaintUpdates(style, hue)) {
        try {
          map.setPaintProperty(u.id, u.prop as Parameters<MlMap['setPaintProperty']>[1], u.value as never)
        } catch {
          // layer missing in this style version: skip
        }
      }
      if (map.hasImage(HATCH_ID)) map.updateImage(HATCH_ID, hatchPixels(hue))
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [hue])

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
    }),
    [],
  )

  return <div ref={container} className="map-canvas" />
}
