import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useEffectsConfig } from '../../effects/EffectsProvider'
import { usePrefersReducedMotion } from '../../lib/hooks'
import { useStored } from '../../lib/store'
import { radsLevel } from '../weather/openMeteo'
import { useWeather } from '../weather/useWeather'
import { formatCoords, searchPlaces, type Place } from './geo'
import { requestOrientationPermission, useHeading } from './heading'
import { useLocation, type LocationStatus } from './useLocation'
import { LegendDrawer, MapInfoBar, NearbyDrawer, PoiCard } from './MapOverlays'
import { nearestPois, type LngLat, type Poi } from './regions'
import { usePlaceName } from './usePlaceName'
import { webglSupported, type MapHandle, type MapScan } from './view'

// Both renderers are split out, so only the one in use is downloaded.
const PipMap = lazy(() => import('./PipMap'))
const LeafletFallback = lazy(() => import('./LeafletFallback'))

const STATUS_TEXT: Record<LocationStatus, string> = {
  idle: '',
  locating: 'ACQUIRING GPS',
  ok: 'GPS LOCK',
  denied: 'GPS DENIED',
  timeout: 'GPS TIMEOUT',
  unavailable: 'NO GPS SIGNAL',
  unsupported: 'NO GPS MODULE',
}

export default function MapPanel() {
  const [cfg] = useEffectsConfig()
  const reducedMotion = usePrefersReducedMotion()
  const loc = useLocation({ auto: true })
  const place = usePlaceName(loc)
  const heading = useHeading(loc.heading, loc.follow)
  const { lat, lon } = loc.coords
  const [renderer, setRenderer] = useState<'gl' | 'raster'>(() => (webglSupported() ? 'gl' : 'raster'))
  const [searchOpen, setSearchOpen] = useState(false)
  const [drawer, setDrawer] = useState<'nearby' | 'legend' | null>(null)
  const [selected, setSelected] = useState<Poi | null>(null)
  const [waypoint, setWaypoint] = useStored<Poi | null>('map:waypoint', null)
  const [scan, setScan] = useState<MapScan>({ pois: [], region: null })
  const mapRef = useRef<MapHandle>(null)
  const from: LngLat = useMemo(() => [lon, lat], [lon, lat])
  const nearby = useMemo(() => nearestPois(scan.pois, from, 8), [scan.pois, from])
  const onScan = useCallback((s: MapScan) => setScan(s), [])
  const toggleDrawer = (d: 'nearby' | 'legend') => setDrawer((cur) => (cur === d ? null : d))
  const pickNearby = (p: Poi) => {
    setSelected(p)
    mapRef.current?.flyTo?.(p.lon, p.lat)
  }

  // Fly to the player when a requested fix (first load, LOCATE, search pick) lands.
  const [centerSeq, setCenterSeq] = useState(0)
  const pendingFly = useRef(true)
  const lastCoords = useRef(`${lat},${lon}`)
  useEffect(() => {
    const k = `${lat},${lon}`
    if (k === lastCoords.current) return
    lastCoords.current = k
    if (!pendingFly.current) return
    pendingFly.current = false
    setCenterSeq((s) => s + 1)
  }, [lat, lon])

  const locate = () => {
    pendingFly.current = true
    setCenterSeq((s) => s + 1)
    loc.request()
    void requestOrientationPermission()
  }
  const toggleFollow = () => {
    if (!loc.follow) {
      void requestOrientationPermission()
      pendingFly.current = true
    }
    loc.setFollow(!loc.follow)
  }
  const pick = (p: Place) => {
    pendingFly.current = true
    loc.setManual(p)
    setSearchOpen(false)
  }

  const status = loc.source === 'search' && loc.status === 'idle' ? 'MANUAL FIX' : STATUS_TEXT[loc.status]
  const lost = loc.source === 'default' && (loc.status === 'denied' || loc.status === 'timeout' || loc.status === 'unavailable' || loc.status === 'unsupported')

  const region = (scan.region ?? place.split(',')[0]).toUpperCase()

  return (
    <div
      className="map-panel"
      onKeyDown={(e) => {
        if (e.key !== 'Escape' || (!selected && !drawer)) return
        e.stopPropagation()
        if (drawer) setDrawer(null)
        else setSelected(null)
      }}
    >
      <header className="map-head">
        <h2 className="map-head__place">[ {place} ]</h2>
        <span className="map-head__meta">
          <span className="map-tag">{loc.source.toUpperCase()}</span>
          {status && (
            <span className={loc.status === 'locating' ? 'map-blink' : undefined}>
              {status}
              {loc.status === 'ok' && loc.accuracy != null && ` ±${Math.round(loc.accuracy)}M`}
            </span>
          )}
        </span>
      </header>

      <div className="map-frame" data-no-swipe>
        <Suspense fallback={<p className="map-standby">ACQUIRING MAP SIGNAL<span className="cursor">▌</span></p>}>
          {renderer === 'gl' ? (
            <PipMap
              ref={mapRef}
              lat={lat}
              lon={lon}
              hue={cfg.hue}
              heading={heading}
              follow={loc.follow}
              reducedMotion={reducedMotion}
              centerSeq={centerSeq}
              onFail={() => setRenderer('raster')}
              selected={selected}
              waypoint={waypoint}
              onSelect={setSelected}
              onScan={onScan}
            />
          ) : (
            <LeafletFallback
              ref={mapRef}
              lat={lat}
              lon={lon}
              hue={cfg.hue}
              heading={heading}
              follow={loc.follow}
              reducedMotion={reducedMotion}
              centerSeq={centerSeq}
            />
          )}
        </Suspense>

        <WeatherCard lat={lat} lon={lon} />

        <div className="map-controls" role="toolbar" aria-label="Map controls">
          <button className="pip-btn map-btn" onClick={locate} aria-label="Locate me">
            <span className="map-btn__ico" aria-hidden>◎</span>
            <span className="map-btn__txt">LOCATE</span>
          </button>
          <button className={`pip-btn map-btn${loc.follow ? ' is-active' : ''}`} onClick={toggleFollow} aria-pressed={loc.follow} aria-label="Follow">
            <span className="map-btn__ico" aria-hidden>➤</span>
            <span className="map-btn__txt">FOLLOW</span>
          </button>
          <button className={`pip-btn map-btn${searchOpen ? ' is-active' : ''}`} onClick={() => setSearchOpen((o) => !o)} aria-expanded={searchOpen} aria-label="Search">
            <span className="map-btn__ico" aria-hidden>⌕</span>
            <span className="map-btn__txt">SEARCH</span>
          </button>
          {renderer === 'gl' && (
            <>
              <button className={`pip-btn map-btn${drawer === 'nearby' ? ' is-active' : ''}`} onClick={() => toggleDrawer('nearby')} aria-expanded={drawer === 'nearby'} aria-label="Nearby">
                <span className="map-btn__ico" aria-hidden>≡</span>
                <span className="map-btn__txt">NEARBY</span>
              </button>
              <button className={`pip-btn map-btn${drawer === 'legend' ? ' is-active' : ''}`} onClick={() => toggleDrawer('legend')} aria-expanded={drawer === 'legend'} aria-label="Legend">
                <span className="map-btn__ico" aria-hidden>?</span>
                <span className="map-btn__txt">LEGEND</span>
              </button>
            </>
          )}
          <div className="map-zoom">
            <button className="pip-btn map-btn map-btn--sq" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in">
              +
            </button>
            <button className="pip-btn map-btn map-btn--sq" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out">
              −
            </button>
          </div>
        </div>

        {searchOpen && <SearchBox onPick={pick} onClose={() => setSearchOpen(false)} />}

        {drawer === 'nearby' && <NearbyDrawer items={nearby} selectedKey={selected?.key} onPick={pickNearby} onClose={() => setDrawer(null)} />}
        {drawer === 'legend' && <LegendDrawer onClose={() => setDrawer(null)} />}

        {selected && (
          <PoiCard
            poi={selected}
            from={from}
            isWaypoint={waypoint?.key === selected.key}
            onWaypoint={() => setWaypoint(waypoint?.key === selected.key ? null : selected)}
            onClose={() => setSelected(null)}
          />
        )}

        <div className="map-foot">
          <span>{formatCoords(lat, lon)}</span>
          {renderer === 'raster' && <span>RASTER MODE</span>}
        </div>

        {lost && (
          <p className="map-banner" role="status">
            {STATUS_TEXT[loc.status]}. DEFAULTING TO THE COMMONWEALTH. USE SEARCH TO SET YOUR SECTOR.
          </p>
        )}
      </div>

      <MapInfoBar region={region} from={from} waypoint={waypoint} onClearWaypoint={() => setWaypoint(null)} />
    </div>
  )
}

function WeatherCard({ lat, lon }: { lat: number; lon: number }) {
  const { weather: w, status } = useWeather(lat, lon)
  return (
    <section className="map-card" aria-label="Local conditions">
      {w ? (
        <>
          <div className="map-card__row">
            <span>TEMP</span>
            <b>
              {w.temp}°{w.units}
            </b>
          </div>
          <div className="map-card__cond">{w.label}</div>
          <div className="map-card__row">
            <span>RADS</span>
            <b>{w.uv.toFixed(1)}</b>
          </div>
          <div className="map-card__sub">{radsLevel(w.uv)}</div>
        </>
      ) : (
        <div className="map-card__cond">{status === 'error' ? 'ATMOS. SENSOR OFFLINE' : 'SCANNING ATMOSPHERE…'}</div>
      )}
    </section>
  )
}

function SearchBox({ onPick, onClose }: { onPick: (p: Place) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<(Place & { detail: string })[] | null>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const abort = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    return () => abort.current?.abort()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    abort.current?.abort()
    const ctrl = (abort.current = new AbortController())
    setState('busy')
    try {
      setResults(await searchPlaces(q, ctrl.signal))
      setState('idle')
    } catch {
      if (!ctrl.signal.aborted) setState('error')
    }
  }

  return (
    <div className="map-search" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}>
      <form onSubmit={submit} className="map-search__form" role="search">
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="CITY NAME"
          aria-label="Search for a city"
          enterKeyHint="search"
          autoComplete="off"
        />
        <button className="pip-btn" type="submit" disabled={q.trim().length < 2}>
          SCAN
        </button>
      </form>
      {state === 'busy' && <p className="map-search__note">SCANNING<span className="cursor">▌</span></p>}
      {state === 'error' && <p className="map-search__note">GEOLOCATOR OFFLINE. TRY AGAIN.</p>}
      {results && state === 'idle' && (
        <ul className="map-search__list">
          {results.length === 0 && <li className="map-search__note">NO MATCHING SETTLEMENTS</li>}
          {results.map((r) => (
            <li key={`${r.lat},${r.lon}`}>
              <button className="map-search__item" onClick={() => onPick(r)}>
                <span>{r.label.split(',')[0]}</span>
                <small>{r.detail}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
