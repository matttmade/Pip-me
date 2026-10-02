import { useClock } from '../clock/useClock'
import { clockShort, wastelandNumeric } from '../clock/time'
import { ICON_BY_ID, ICON_VIEWBOX, ICONS, type IconId } from './icons'
import { poiKind } from './poi'
import { formatDistance, formatVector, type LngLat, type Poi } from './regions'

export function PipIcon({ id, size = 24, className }: { id: IconId; size?: number; className?: string }) {
  const icon = ICON_BY_ID[id]
  return (
    <svg className={className} viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`} width={size} height={size} aria-hidden="true">
      <path d={icon.path} fill="currentColor" fillRule={icon.rule} />
    </svg>
  )
}

/** Reference-style footer: three framed boxes (date, time, region) + the active waypoint. */
export function MapInfoBar({ region, from, waypoint, onClearWaypoint }: { region: string; from: LngLat; waypoint: Poi | null; onClearWaypoint: () => void }) {
  const now = useClock()
  return (
    <footer className="map-info" aria-label="Map info">
      {waypoint && (
        <div className="map-info__wp">
          <PipIcon id={waypoint.cat} size={16} />
          <span className="map-info__wp-name">{waypoint.name}</span>
          <b>{formatVector(from, [waypoint.lon, waypoint.lat])}</b>
          <button className="map-info__x" onClick={onClearWaypoint} aria-label="Clear waypoint">
            ×
          </button>
        </div>
      )}
      <div className="map-info__boxes">
        <div className="status-box map-info__box">{wastelandNumeric(now)}</div>
        <div className="status-box map-info__box">{clockShort(now)}</div>
        <div className="status-box map-info__box map-info__region" title="Region">
          {region}
        </div>
      </div>
    </footer>
  )
}

/** Detail card for the selected location. */
export function PoiCard({
  poi,
  from,
  isWaypoint,
  onWaypoint,
  onClose,
}: {
  poi: Poi
  from: LngLat
  isWaypoint: boolean
  onWaypoint: () => void
  onClose: () => void
}) {
  const kind = poiKind(poi)
  const cat = ICON_BY_ID[poi.cat].label
  return (
    <section className="map-poi" aria-label={`${poi.name} details`} aria-live="polite">
      <header className="map-poi__head">
        <PipIcon id={poi.cat} size={22} className="map-poi__icon" />
        <span className="map-poi__cat">
          {cat}
          {kind && kind !== cat && <small> · {kind}</small>}
        </span>
        <button className="map-poi__x" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <h3 className="map-poi__name">{poi.name}</h3>
      <p className="map-poi__vec">{formatVector(from, [poi.lon, poi.lat])}</p>
      <button className={`pip-btn map-poi__btn${isWaypoint ? ' is-active' : ''}`} onClick={onWaypoint} aria-pressed={isWaypoint}>
        [ {isWaypoint ? 'CLEAR WAYPOINT' : 'SET WAYPOINT'} ]
      </button>
    </section>
  )
}

/** Keyboard/screen-reader route to the icon field: closest locations in view. */
export function NearbyDrawer({
  items,
  selectedKey,
  onPick,
  onClose,
}: {
  items: (Poi & { dist: number })[]
  selectedKey?: string
  onPick: (p: Poi) => void
  onClose: () => void
}) {
  return (
    <aside className="map-drawer" aria-label="Nearby locations" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}>
      <h3 className="map-drawer__title">
        <span>NEARBY</span>
        <button className="map-drawer__x" onClick={onClose} aria-label="Close nearby list">
          ×
        </button>
      </h3>
      {items.length === 0 ? (
        <p className="pip-note">NO LOCATIONS IN RANGE. ZOOM IN OR PAN.</p>
      ) : (
        <ul className="map-drawer__list">
          {items.map((p) => (
            <li key={p.key}>
              <button className={`pip-row map-near${p.key === selectedKey ? ' is-selected' : ''}`} onClick={() => onPick(p)}>
                <PipIcon id={p.cat} size={18} className="map-near__icon" />
                <span className="map-near__name">{p.name}</span>
                <span className="pip-row__right">{formatDistance(p.dist)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

export function LegendDrawer({ onClose }: { onClose: () => void }) {
  return (
    <aside className="map-drawer map-drawer--legend" aria-label="Map legend" onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}>
      <h3 className="map-drawer__title">
        <span>LEGEND</span>
        <button className="map-drawer__x" onClick={onClose} aria-label="Close legend">
          ×
        </button>
      </h3>
      <ul className="map-legend">
        {ICONS.map((i) => (
          <li key={i.id}>
            <PipIcon id={i.id} size={20} />
            <span>{i.label}</span>
          </li>
        ))}
        <li>
          <span className="map-legend__swatch map-legend__swatch--hatch" />
          <span>ZONE</span>
        </li>
        <li>
          <span className="map-legend__swatch map-legend__swatch--dots" />
          <span>PARKLAND</span>
        </li>
        <li>
          <span className="map-legend__swatch map-legend__swatch--route" />
          <span>WAYPOINT</span>
        </li>
      </ul>
    </aside>
  )
}
