import type { Poi } from './regions'
import { iconImageId, type IconId } from './icons'

/**
 * OpenMapTiles `poi` class/subclass → Pip icon. `null` hides the feature (street clutter).
 * One table drives both the JS lookup (lists, cards) and the GL expression (rendering),
 * so the two can't disagree.
 */
export const CLASS_ICON: Record<string, IconId | null> = {
  lodging: 'house',
  car: 'factory',
  place_of_worship: 'church',
  hospital: 'medical',
  doctors: 'medical',
  dentist: 'medical',
  pharmacy: 'medical',
  veterinary: 'medical',
  police: 'police',
  fuel: 'fuel',
  shop: 'shop',
  grocery: 'shop',
  clothing_store: 'shop',
  bakery: 'shop',
  hairdresser: 'shop',
  florist: 'shop',
  laundry: 'shop',
  jewelry: 'shop',
  restaurant: 'diner',
  fast_food: 'diner',
  cafe: 'diner',
  ice_cream: 'diner',
  bar: 'bar',
  beer: 'bar',
  alcohol_shop: 'bar',
  school: 'school',
  college: 'school',
  kindergarten: 'school',
  library: 'library',
  museum: 'museum',
  art_gallery: 'museum',
  town_hall: 'museum',
  castle: 'museum',
  aquarium: 'museum',
  theatre: 'theater',
  cinema: 'theater',
  music: 'theater',
  park: 'park',
  garden: 'park',
  playground: 'park',
  dog_park: 'park',
  picnic_site: 'park',
  zoo: 'park',
  monument: 'monument',
  harbor: 'harbor',
  ferry_terminal: 'harbor',
  railway: 'transit',
  aerialway: 'transit',
  airport: 'airport',
  aerodrome: 'airport',
  fire_station: 'fire',
  stadium: 'stadium',
  sports_centre: 'stadium',
  swimming: 'stadium',
  golf: 'stadium',
  ice_rink: 'stadium',
  pitch: 'stadium',
  campsite: 'camp',
  post: 'tower',
  bank: 'caps',
  shelter: 'shelter',
  cemetery: 'cemetery',
  attraction: 'landmark',
  // clutter
  parking: null,
  bicycle_parking: null,
  bicycle_rental: null,
  bicycle: null,
  gate: null,
  lift_gate: null,
  bollard: null,
  toilets: null,
  drinking_water: null,
  waste_basket: null,
  atm: null,
  recycling: null,
  bench: null,
  information: null,
  entrance: null,
  telephone: null,
  vending: null,
  office: null,
  bus: null,
  brownfield: null,
  escape_game: null,
}

/** Subclass overrides (checked first). */
export const SUBCLASS_ICON: Record<string, IconId | null> = {
  bus_station: 'transit',
  bus_stop: null,
  subway_entrance: null,
  post_box: null,
  post_office: 'tower',
  books: 'shop',
  hardware: 'factory',
  doityourself: 'factory',
  car_repair: 'factory',
  car_parts: 'factory',
  tyres: 'factory',
  artwork: 'monument',
  memorial: 'monument',
  viewpoint: 'landmark',
  charging_station: 'fuel',
  marina: 'harbor',
  dock: 'harbor',
  grave_yard: 'cemetery',
  hostel: 'house',
}

/** Unknown classes still show (if named) as a generic landmark. */
export const DEFAULT_ICON: IconId = 'landmark'

export function poiCategory(cls: unknown, subclass?: unknown): IconId | null {
  if (typeof subclass === 'string' && subclass in SUBCLASS_ICON) return SUBCLASS_ICON[subclass]
  if (typeof cls === 'string' && cls in CLASS_ICON) return CLASS_ICON[cls]
  return DEFAULT_ICON
}

/** `match` arms grouped by output: [[inputs], output, …]. */
function matchArms(table: Record<string, IconId | null>): unknown[] {
  const groups = new Map<string, string[]>()
  for (const [k, v] of Object.entries(table)) {
    const out = v ? iconImageId(v) : ''
    groups.set(out, [...(groups.get(out) ?? []), k])
  }
  return [...groups].flatMap(([out, keys]) => [keys, out])
}

/** GL expression: the MapLibre image id for a poi feature, or '' when hidden. */
export function poiIconExpression(): unknown[] {
  return [
    'match',
    ['coalesce', ['get', 'subclass'], ''],
    ...matchArms(SUBCLASS_ICON),
    ['match', ['coalesce', ['get', 'class'], ''], ...matchArms(CLASS_ICON), iconImageId(DEFAULT_ICON)],
  ]
}

/** Display name for a feature (English when the tiles carry it). */
export function poiName(props: Record<string, unknown> | null | undefined): string | null {
  const n = props?.['name:en'] ?? props?.name_en ?? props?.name
  return typeof n === 'string' && n.trim() ? n.trim() : null
}

type FeatureLike = {
  id?: string | number
  properties?: Record<string, unknown> | null
  geometry?: { type: string; coordinates?: unknown } | null
  layer?: { id: string }
  sourceLayer?: string
}

/** A rendered/queried MapLibre feature → Poi, or null if it shouldn't be listed. */
export function featureToPoi(f: FeatureLike): Poi | null {
  const name = poiName(f.properties)
  if (!name || f.geometry?.type !== 'Point') return null
  const [lon, lat] = f.geometry.coordinates as [number, number]
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
  const cls = typeof f.properties?.class === 'string' ? f.properties.class : undefined
  const subclass = typeof f.properties?.subclass === 'string' ? f.properties.subclass : undefined
  const air = f.sourceLayer === 'aerodrome_label' || f.layer?.id === 'pip-poi-air'
  const cat = air ? 'airport' : poiCategory(cls, subclass)
  if (!cat) return null
  const key = f.id != null ? `${f.sourceLayer ?? 'poi'}:${f.id}` : `${name}@${lon.toFixed(5)},${lat.toFixed(5)}`
  return { key, name, cat, lon, lat, cls, subclass }
}

/** `PUB`, `SUPERMARKET`: the most specific tag, for the detail card. */
export function poiKind(p: Pick<Poi, 'cls' | 'subclass'>): string | null {
  const t = p.subclass && p.subclass !== p.cls ? p.subclass : p.cls
  return t ? t.replace(/_/g, ' ').toUpperCase() : null
}
