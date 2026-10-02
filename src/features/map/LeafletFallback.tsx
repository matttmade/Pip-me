import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { createPlayerEl, leafletFilter, setPlayerHeading, START_ZOOM, type MapViewProps } from './view'

/** Raster fallback: Leaflet + OSM tiles pushed through a CSS filter into the Pip hue. */
export default function LeafletFallback({ ref, lat, lon, hue, heading, follow, reducedMotion, centerSeq }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerEl = useRef<HTMLElement | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const latest = useRef({ lat, lon, reducedMotion })
  useLayoutEffect(() => {
    latest.current = { lat, lon, reducedMotion }
  })

  useEffect(() => {
    if (!container.current) return
    const { lat, lon, reducedMotion } = latest.current
    const map = L.map(container.current, {
      center: [lat, lon],
      zoom: START_ZOOM,
      zoomControl: false,
      keyboard: false,
      zoomAnimation: !reducedMotion,
      fadeAnimation: !reducedMotion,
      attributionControl: true,
    })
    map.attributionControl.setPrefix(false)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      className: 'pip-osm-tiles',
    }).addTo(map)
    const el = createPlayerEl()
    markerEl.current = el
    markerRef.current = L.marker([lat, lon], {
      icon: L.divIcon({ html: el, className: 'pip-player-icon', iconSize: [44, 44], iconAnchor: [22, 22] }),
      keyboard: false,
      interactive: false,
    }).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    container.current?.style.setProperty('--osm-filter', leafletFilter(hue))
  }, [hue])

  useEffect(() => {
    if (markerEl.current) setPlayerHeading(markerEl.current, heading)
  }, [heading])

  useEffect(() => {
    markerRef.current?.setLatLng([lat, lon])
    if (follow) mapRef.current?.panTo([lat, lon], { animate: !reducedMotion })
  }, [lat, lon, follow, reducedMotion])

  const lastSeq = useRef(centerSeq)
  useEffect(() => {
    if (lastSeq.current === centerSeq) return
    lastSeq.current = centerSeq
    const { lat, lon, reducedMotion } = latest.current
    mapRef.current?.setView([lat, lon], Math.max(mapRef.current.getZoom(), START_ZOOM - 1), { animate: !reducedMotion })
  }, [centerSeq])

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      recenter: () => mapRef.current?.panTo([latest.current.lat, latest.current.lon]),
    }),
    [],
  )

  return <div ref={container} className="map-canvas map-canvas--raster" />
}
