import { hslToRgb, pipRgb } from '../../effects/color'

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
    bg: rgb(hslToRgb(hue, 0.6, 0.04)),
    bgSolid: hslToRgb(hue, 0.6, 0.04),
    pipRgb: pip,
    pip: rgb(pip),
    hi: rgb(pipRgb(hue, 0.75)),
    a: (alpha: number) => rgb(pip, alpha),
    shadow: rgb(hslToRgb(hue, 0.6, 0.05), 0.9),
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
      return { paint: { 'background-color': p.bg } }
    case 'raster':
      return { hide: true }
    case 'water':
      return hatch
        ? { paint: { 'fill-pattern': HATCH_ID, 'fill-opacity': 0.9 } }
        : { paint: { 'fill-color': p.a(0.12) } }
    case 'waterway':
      return { paint: { 'line-color': p.a(0.35) }, keep: LINE_GEOMETRY }
    case 'park':
      return { paint: { 'fill-color': p.a(0.07), 'fill-outline-color': p.a(0.25) } }
    case 'park-outline':
      return { paint: { 'line-color': p.a(0.3), 'line-dasharray': [2, 2] } }
    case 'landcover':
      return { paint: { 'fill-color': p.a(0.05), 'fill-antialias': false } }
    case 'landuse':
      return { paint: { 'fill-color': p.a(0.035) } }
    case 'aeroway-fill':
      return { paint: { 'fill-color': p.a(0.08) } }
    case 'aeroway-line':
      return { paint: { 'line-color': p.a(0.45) }, keep: LINE_GEOMETRY }
    case 'road-casing':
      // Dark casing separates crossing roads like an etched line.
      return { paint: { 'line-color': p.bg }, keep: LINE_GEOMETRY }
    case 'road-major':
      return { paint: { 'line-color': p.pip }, keep: LINE_GEOMETRY }
    case 'road-mid':
      return { paint: { 'line-color': p.a(0.75) }, keep: LINE_GEOMETRY }
    case 'road-minor':
      return { paint: { 'line-color': p.a(0.42) }, keep: LINE_GEOMETRY }
    case 'road-path':
      return { paint: { 'line-color': p.a(0.4), 'line-dasharray': [1.5, 1.5] }, keep: ['line-width'] }
    case 'rail':
      return { paint: { 'line-color': p.a(0.45) }, keep: LINE_GEOMETRY }
    case 'road-area':
      return { paint: { 'fill-color': p.a(0.06) } }
    case 'building':
      return { paint: { 'fill-color': p.a(0.04), 'fill-outline-color': p.a(0.45) } }
    case 'building-3d':
      return { hide: true }
    case 'boundary':
      return { paint: { 'line-color': p.a(0.5), 'line-dasharray': [3, 2] }, keep: ['line-width'] }
    case 'label-place':
      return label(1)
    case 'label-road':
      return label(0.75)
    case 'label-water':
      return label(0.55)
    case 'poi':
      return label(0.6)
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
  if (role === 'poi') out.minzoom = Math.max(layer.minzoom ?? 0, 15)
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

/** The whole style, recolored. Sources, glyphs and sprite are kept. */
export function pipMapStyle<S extends MapStyle>(style: S, hue: number, opts: { hatch?: boolean } = {}): S {
  const hatch = opts.hatch ?? true
  return { ...style, layers: style.layers.map((l) => restyleLayer(l, hue, hatch)) }
}

export type PaintUpdate = { id: string; prop: string; value: unknown }

/** The hue-dependent paint props for every visible layer: feed to map.setPaintProperty. */
export function huePaintUpdates(style: MapStyle, hue: number, opts: { hatch?: boolean } = {}): PaintUpdate[] {
  const out: PaintUpdate[] = []
  for (const l of pipMapStyle(style, hue, opts).layers) {
    if (l.layout?.visibility === 'none') continue
    for (const [prop, value] of Object.entries(l.paint ?? {})) {
      if (prop.endsWith('-color')) out.push({ id: l.id, prop, value })
    }
  }
  return out
}

/**
 * RGBA pixels for the water hatch pattern: dim fill with bright 45° rules.
 * Returned as a plain object that map.addImage accepts.
 */
export function hatchPixels(hue: number, size = 8): { width: number; height: number; data: Uint8Array } {
  const [br, bg, bb] = hslToRgb(hue, 0.6, 0.07)
  const [lr, lg, lb] = pipRgb(hue, 0.4)
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
