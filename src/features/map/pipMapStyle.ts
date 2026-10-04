import { hslToRgb, PIP_SAT, pipRgb } from '../../effects/color'
import { iconImageId } from './icons'
import { poiIconExpression } from './poi'

/**
 * Recolors a hosted MapLibre style (OpenFreeMap "liberty") into the Pip-Boy palette.
 * Pure: style JSON in, new style JSON out. Layers are matched by type / source-layer /
 * class filters rather than ids, so upstream id changes degrade to "dimmed", not broken.
 */

export type MapLayer = {
  id: string
  type: string
  source?: string
  'source-layer'?: string
  filter?: unknown
  minzoom?: number
  maxzoom?: number
  paint?: Record<string, unknown>
  layout?: Record<string, unknown>
  [k: string]: unknown
}
export type MapStyle = { version?: number; layers: MapLayer[]; [k: string]: unknown }

export const HATCH_ID = 'pip-hatch'
/** Transparent diagonal hatch for industrial/military/… regions of interest. */
export const ROI_HATCH_ID = 'pip-roi-hatch'
/** Transparent dot screen for parks. */
export const ROI_DOTS_ID = 'pip-roi-dots'
export const WAYPOINT_SOURCE = 'pip-waypoint'
export const ACTIVE_ROI_SOURCE = 'pip-roi-active'
export const REGION_LABEL_LAYER = 'pip-region-label'
/** POI symbol layers, most important first (query these for hover / NEARBY). */
export const POI_LAYERS = ['pip-poi-1', 'pip-poi-2', 'pip-poi-3', 'pip-poi-air'] as const
/** Landuse classes drawn as hatched regions of interest. */
export const ROI_LANDUSE = ['industrial', 'military', 'cemetery', 'hospital', 'school', 'university', 'college', 'railway', 'retail', 'commercial', 'stadium', 'zoo', 'theme_park', 'quarry', 'garages']
/** Place classes that name parts of a city (region labels). */
export const REGION_PLACES = ['suburb', 'quarter', 'neighbourhood']

export type Role =
  | 'background'
  | 'raster'
  | 'water'
  | 'waterway'
  | 'park'
  | 'park-outline'
  | 'landcover'
  | 'landuse'
  | 'aeroway-fill'
  | 'aeroway-line'
  | 'road-casing'
  | 'road-major'
  | 'road-mid'
  | 'road-minor'
  | 'road-path'
  | 'rail'
  | 'road-area'
  | 'building'
  | 'building-3d'
  | 'boundary'
  | 'label-place'
  | 'label-road'
  | 'label-water'
  | 'label-region'
  | 'poi'
  | 'hidden-symbol'
  | 'other'

const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w))

/** Decide what a layer depicts. */
export function classifyLayer(layer: MapLayer): Role {
  const sl = layer['source-layer'] ?? ''
  const id = layer.id.toLowerCase()
  const f = JSON.stringify(layer.filter ?? '')
  const t = layer.type
  if (t === 'background') return 'background'
  if (t === 'raster' || t === 'hillshade') return 'raster'
  if (t === 'fill-extrusion') return 'building-3d'

  if (t === 'symbol') {
    // Road shields, one-way arrows and other icon-only clutter.
    if (has(id, 'shield', 'arrow', 'oneway', 'one_way')) return 'hidden-symbol'
    if (sl === 'poi' || sl === 'aerodrome_label' || id.startsWith('poi')) return 'poi'
    if (sl === 'transportation_name' || has(id, 'highway-name', 'road_label', 'road-label')) return 'label-road'
    if (sl === 'water_name' || sl === 'waterway' || has(id, 'water')) return 'label-water'
    // Neighbourhood/suburb labels: replaced by the Pip region labels.
    if (sl === 'place' && (has(id, 'other', 'suburb', 'neighbourhood') || has(f, 'suburb', 'neighbourhood', 'quarter'))) return 'label-region'
    return 'label-place'
  }

  if (sl === 'water' || (t === 'fill' && id === 'water')) return 'water'
  if (sl === 'waterway') return 'waterway'
  if (sl === 'park') return t === 'line' ? 'park-outline' : 'park'
  if (sl === 'landcover') return 'landcover'
  if (sl === 'landuse') return 'landuse'
  if (sl === 'aeroway') return t === 'fill' ? 'aeroway-fill' : 'aeroway-line'
  if (sl === 'building') return 'building'
  if (sl === 'boundary') return 'boundary'
  if (sl === 'transportation' || has(id, 'road', 'bridge', 'tunnel', 'highway')) {
    if (t === 'fill') return 'road-area'
    if (has(f + id, 'rail', 'transit')) return 'rail'
    if (id.includes('casing')) return 'road-casing'
    if (has(id, 'path', 'pedestrian', 'footway', 'cycleway')) return 'road-path'
    if (has(f + id, 'motorway', 'trunk', 'primary')) return 'road-major'
    if (has(f + id, 'secondary', 'tertiary')) return 'road-mid'
    return 'road-minor'
  }
  return 'other'
}

const rgb = ([r, g, b]: [number, number, number], a = 1) => (a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`)

/** Palette derived from the SYSTEM hue (same math as tokens.css). */
export function pipPalette(hue: number) {
  const pip = pipRgb(hue)
  return {
    bg: rgb(hslToRgb(hue, PIP_SAT, 0.04)),
    bgSolid: hslToRgb(hue, PIP_SAT, 0.04),
    /** Land: a touch lighter than the screen so water reads darker (reference). */
    land: rgb(hslToRgb(hue, PIP_SAT, 0.075)),
    pipRgb: pip,
    pip: rgb(pip),
    hi: rgb(pipRgb(hue, 0.75)),
    a: (alpha: number) => rgb(pip, alpha),
    shadow: rgb(hslToRgb(hue, PIP_SAT, 0.05), 0.9),
  }
}

type Paint = Record<string, unknown>
type Restyle = { paint?: Paint; layout?: Paint; hide?: boolean; keep?: string[]; dropLayout?: string[] }

const LINE_GEOMETRY = ['line-width', 'line-gap-width', 'line-offset', 'line-dasharray']
const SYMBOL_ICON = ['icon-image', 'icon-size', 'icon-allow-overlap', 'icon-optional', 'icon-rotate', 'icon-rotation-alignment']

/** Paint (and layout tweaks) for one role. Only *-color props depend on the hue. */
function restyle(role: Role, hue: number, hatch: boolean): Restyle {
  const p = pipPalette(hue)
  // Dark, soft halo: keeps labels legible over bright roads and reads as phosphor bloom.
  const glow = { 'text-halo-color': p.shadow, 'text-halo-width': 1.6, 'text-halo-blur': 1.4 }
  const label = (alpha: number) => ({
    paint: { 'text-color': p.a(alpha), ...glow },
    layout: { 'text-transform': 'uppercase', 'text-letter-spacing': 0.12 },
    dropLayout: SYMBOL_ICON,
  })
  switch (role) {
    case 'background':
      return { paint: { 'background-color': p.land } }
    case 'raster':
      return { hide: true }
    case 'water':
      return hatch
        ? { paint: { 'fill-pattern': HATCH_ID, 'fill-opacity': 1 } }
        : { paint: { 'fill-color': p.bg } }
    case 'waterway':
      return { paint: { 'line-color': p.a(0.22) }, keep: LINE_GEOMETRY }
    case 'park':
    case 'park-outline':
      // Replaced by the dotted Pip region-of-interest layers.
      return { hide: true }
    case 'landcover':
      return { paint: { 'fill-color': p.a(0.03), 'fill-antialias': false } }
    case 'landuse':
      return { paint: { 'fill-color': p.a(0.02) } }
    case 'aeroway-fill':
      return { paint: { 'fill-color': p.a(0.05) } }
    case 'aeroway-line':
      return { paint: { 'line-color': p.a(0.25) }, keep: LINE_GEOMETRY }
    case 'road-casing':
      // Casing in the land color separates crossing roads like an etched line.
      return { paint: { 'line-color': p.land }, keep: LINE_GEOMETRY }
    case 'road-major':
      return { paint: { 'line-color': p.a(0.26) }, keep: LINE_GEOMETRY }
    case 'road-mid':
      return { paint: { 'line-color': p.a(0.2) }, keep: LINE_GEOMETRY }
    case 'road-minor':
      return { paint: { 'line-color': p.a(0.12) }, keep: LINE_GEOMETRY }
    case 'road-path':
      return { paint: { 'line-color': p.a(0.1), 'line-dasharray': [1.5, 1.5] }, keep: ['line-width'] }
    case 'rail':
      return { paint: { 'line-color': p.a(0.16) }, keep: LINE_GEOMETRY }
    case 'road-area':
      return { paint: { 'fill-color': p.a(0.03) } }
    case 'building':
      return { paint: { 'fill-color': p.a(0.025), 'fill-outline-color': p.a(0.14) } }
    case 'building-3d':
      return { hide: true }
    case 'boundary':
      return { paint: { 'line-color': p.a(0.3), 'line-dasharray': [3, 2] }, keep: ['line-width'] }
    case 'label-place':
      return label(0.8)
    case 'label-road':
      return label(0.32)
    case 'label-water':
      return label(0.4)
    case 'label-region':
    case 'poi':
      // Upstream POIs and neighbourhood labels compete with the Pip icon field.
      return { hide: true }
    case 'hidden-symbol':
      return { hide: true }
    default:
      return {}
  }
}

/** Fallback for layers we don't recognise: keep geometry, dim them. */
function dimUnknown(layer: MapLayer, hue: number): Restyle {
  const p = pipPalette(hue)
  switch (layer.type) {
    case 'line':
      return { paint: { 'line-color': p.a(0.2) }, keep: LINE_GEOMETRY }
    case 'fill':
      return { paint: { 'fill-color': p.a(0.04) } }
    case 'symbol':
      return {
        paint: { 'text-color': p.a(0.5), 'text-halo-color': p.a(0.25), 'text-halo-width': 1 },
        layout: { 'text-transform': 'uppercase' },
        dropLayout: SYMBOL_ICON,
      }
    case 'circle':
      return { paint: { 'circle-color': p.a(0.4) } }
    default:
      return { hide: true }
  }
}

export function restyleLayer(layer: MapLayer, hue: number, hatch = true): MapLayer {
  const role = classifyLayer(layer)
  const r = role === 'other' ? dimUnknown(layer, hue) : restyle(role, hue, hatch)
  const out: MapLayer = { ...layer }
  if (r.hide) {
    out.layout = { ...layer.layout, visibility: 'none' }
    return out
  }
  if (r.paint) {
    const kept: Paint = {}
    for (const k of r.keep ?? []) if (layer.paint && k in layer.paint) kept[k] = layer.paint[k]
    out.paint = { ...kept, ...r.paint }
  }
  if (r.layout || r.dropLayout) {
    const layout: Paint = { ...layer.layout }
    for (const k of r.dropLayout ?? []) delete layout[k]
    if (layer.type === 'symbol' && !layout['text-field']) {
      // icon-only symbol with its icon removed: nothing left to draw
      layout.visibility = 'none'
    }
    out.layout = { ...layout, ...r.layout }
  }
  return out
}

export type StyleOpts = { hatch?: boolean; /** Region name to draw brighter. */ activeRegion?: string | null }

const EMPTY_FC = { type: 'FeatureCollection', features: [] }
const FONT = ['Noto Sans Regular']
const isPolygon = ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false]
const isPoint = ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false]
const roiLanduse = ['all', isPolygon, ['match', ['get', 'class'], ROI_LANDUSE, true, false]]

/** Region label color: the active region (under the map center) is brighter. */
export function regionLabelColor(hue: number, active?: string | null): unknown {
  const p = pipPalette(hue)
  return active ? ['case', ['==', ['coalesce', ['get', 'name:en'], ['get', 'name']], active], p.a(0.85), p.a(0.38)] : p.a(0.38)
}

/** Regions of interest: hatched/dotted fills with dashed borders. Sit under roads. */
export function roiLayers(hue: number, source = 'openmaptiles'): MapLayer[] {
  const p = pipPalette(hue)
  const dash = { 'line-dasharray': [3, 2.5] }
  return [
    { id: 'pip-roi-fill', type: 'fill', source, 'source-layer': 'landuse', filter: roiLanduse, paint: { 'fill-pattern': ROI_HATCH_ID, 'fill-opacity': 0.9 } },
    { id: 'pip-roi-park-fill', type: 'fill', source, 'source-layer': 'park', filter: isPolygon, paint: { 'fill-pattern': ROI_DOTS_ID, 'fill-opacity': 0.9 } },
    { id: 'pip-roi-line', type: 'line', source, 'source-layer': 'landuse', filter: roiLanduse, minzoom: 12, paint: { 'line-color': p.a(0.3), 'line-width': 1, ...dash } },
    { id: 'pip-roi-park-line', type: 'line', source, 'source-layer': 'park', filter: isPolygon, paint: { 'line-color': p.a(0.3), 'line-width': 1, ...dash } },
    { id: 'pip-roi-active-fill', type: 'fill', source: ACTIVE_ROI_SOURCE, paint: { 'fill-color': p.a(0.06) } },
    { id: 'pip-roi-active-line', type: 'line', source: ACTIVE_ROI_SOURCE, paint: { 'line-color': p.a(0.65), 'line-width': 1.5, ...dash } },
  ]
}

/** Region labels, waypoint line and the POI icon field. Sit on top of everything. */
export function overlayLayers(hue: number, opts: StyleOpts = {}, source = 'openmaptiles'): MapLayer[] {
  const p = pipPalette(hue)
  const icon = poiIconExpression()
  const iconLayout = {
    'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.6, 14, 0.85, 16, 1, 18, 1.15],
    'icon-allow-overlap': false,
    'icon-padding': 4,
    'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
  }
  // Phosphor glow comes from the SDF halo: no extra layer, no per-frame JS.
  const iconPaint = { 'icon-color': p.pip, 'icon-halo-color': p.a(0.55), 'icon-halo-width': 1.4, 'icon-halo-blur': 1.6 }
  const poi = (id: string, rank: unknown[], minzoom: number): MapLayer => ({
    id,
    type: 'symbol',
    source,
    'source-layer': 'poi',
    minzoom,
    filter: ['all', isPoint, ['has', 'name'], ['!=', icon, ''], rank],
    layout: { 'icon-image': icon, ...iconLayout },
    paint: iconPaint,
  })
  const rank = ['coalesce', ['get', 'rank'], 99]
  return [
    {
      id: 'pip-waypoint-line',
      type: 'line',
      source: WAYPOINT_SOURCE,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': p.hi, 'line-width': 2, 'line-dasharray': [2, 2] },
    },
    {
      id: REGION_LABEL_LAYER,
      type: 'symbol',
      source,
      'source-layer': 'place',
      minzoom: 11,
      filter: ['match', ['get', 'class'], REGION_PLACES, true, false],
      layout: {
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-font': FONT,
        'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 13],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.3,
        'text-max-width': 8,
        'text-padding': 12,
      },
      paint: { 'text-color': regionLabelColor(hue, opts.activeRegion), 'text-halo-color': p.shadow, 'text-halo-width': 1.4 },
    },
    // Higher layers are placed first, so the airfield + rank-1 icons win collisions.
    poi('pip-poi-3', ['>', rank, 24], 16),
    poi('pip-poi-2', ['all', ['>', rank, 10], ['<=', rank, 24]], 14.5),
    poi('pip-poi-1', ['<=', rank, 10], 12),
    {
      id: 'pip-poi-air',
      type: 'symbol',
      source,
      'source-layer': 'aerodrome_label',
      minzoom: 9,
      filter: ['has', 'name'],
      layout: { 'icon-image': iconImageId('airport'), ...iconLayout, 'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 14, 1] },
      paint: iconPaint,
    },
  ]
}

const ROADISH: Role[] = ['waterway', 'water', 'aeroway-fill', 'aeroway-line', 'road-casing', 'road-major', 'road-mid', 'road-minor', 'road-path', 'rail', 'road-area', 'building']

/**
 * The whole style, recolored, plus the Pip layers (regions of interest under the roads,
 * region labels / waypoint / POI icons on top) and their GeoJSON sources.
 */
export function pipMapStyle<S extends MapStyle>(style: S, hue: number, opts: StyleOpts = {}): S {
  const hatch = opts.hatch ?? true
  const base = style.layers.map((l) => restyleLayer(l, hue, hatch))
  const vector = Object.entries((style.sources ?? {}) as Record<string, { type?: string }>).find(([, s]) => s?.type === 'vector')?.[0] ?? 'openmaptiles'
  let at = style.layers.findIndex((l) => ROADISH.includes(classifyLayer(l)))
  if (at < 0) at = base.length
  const layers = [...base.slice(0, at), ...roiLayers(hue, vector), ...base.slice(at), ...overlayLayers(hue, opts, vector)]
  const sources = {
    ...(style.sources as Record<string, unknown>),
    [WAYPOINT_SOURCE]: { type: 'geojson', data: EMPTY_FC },
    [ACTIVE_ROI_SOURCE]: { type: 'geojson', data: EMPTY_FC },
  }
  return { ...style, sources, layers }
}

export type PaintUpdate = { id: string; prop: string; value: unknown }

/** The hue-dependent paint props for every visible layer: feed to map.setPaintProperty. */
export function huePaintUpdates(style: MapStyle, hue: number, opts: StyleOpts = {}): PaintUpdate[] {
  const out: PaintUpdate[] = []
  for (const l of pipMapStyle(style, hue, opts).layers) {
    if (l.layout?.visibility === 'none') continue
    for (const [prop, value] of Object.entries(l.paint ?? {})) {
      if (prop.endsWith('-color')) out.push({ id: l.id, prop, value })
    }
  }
  return out
}

type Pixels = { width: number; height: number; data: Uint8Array }

/**
 * RGBA pixels for the water hatch pattern: a fill darker than the land with dim 45° rules.
 * Returned as a plain object that map.addImage accepts.
 */
export function hatchPixels(hue: number, size = 8): Pixels {
  const [br, bg, bb] = hslToRgb(hue, 0.6, 0.035)
  const [lr, lg, lb] = hslToRgb(hue, 0.7, 0.13)
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const line = (x + y) % size === 0
      data[i] = line ? lr : br
      data[i + 1] = line ? lg : bg
      data[i + 2] = line ? lb : bb
      data[i + 3] = 255
    }
  }
  return { width: size, height: size, data }
}

/** Transparent tile with phosphor pixels where `on(x, y)`. */
function sparsePixels(hue: number, size: number, alpha: number, on: (x: number, y: number) => boolean): Pixels {
  const [r, g, b] = pipRgb(hue)
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!on(x, y)) continue
      const i = (y * size + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = alpha
    }
  }
  return { width: size, height: size, data }
}

/** Region-of-interest hatch: faint 45° rules on transparent. */
export const roiHatchPixels = (hue: number, size = 10) => sparsePixels(hue, size, 46, (x, y) => (x + y) % size === 0)
/** Park dot screen: one faint dot per cell, offset every other row. */
export const roiDotPixels = (hue: number, size = 8) =>
  sparsePixels(hue, size, 70, (x, y) => (y === 1 && x === 1) || (y === 5 && x === 5))

/** Every pattern image the style uses, keyed by id (for addImage / updateImage on hue change). */
export function patternImages(hue: number): Record<string, Pixels> {
  return { [HATCH_ID]: hatchPixels(hue), [ROI_HATCH_ID]: roiHatchPixels(hue), [ROI_DOTS_ID]: roiDotPixels(hue) }
}
