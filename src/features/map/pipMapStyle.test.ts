import { describe, expect, it } from 'vitest'
import { createExpression, featureFilter } from '@maplibre/maplibre-gl-style-spec'
import {
  ACTIVE_ROI_SOURCE,
  classifyLayer,
  hatchPixels,
  HATCH_ID,
  huePaintUpdates,
  patternImages,
  pipMapStyle,
  pipPalette,
  POI_LAYERS,
  REGION_LABEL_LAYER,
  regionLabelColor,
  ROI_DOTS_ID,
  ROI_HATCH_ID,
  roiHatchPixels,
  WAYPOINT_SOURCE,
  type MapStyle,
} from './pipMapStyle'

// A trimmed-down OpenFreeMap "liberty" style: one layer of each kind.
const fixture: MapStyle = {
  version: 8,
  sources: { openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
    { id: 'natural_earth', type: 'raster', source: 'ne2_shaded', paint: { 'raster-opacity': 0.5 } },
    { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': '#d8e8c8' } },
    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': 'rgb(158,189,255)' } },
    {
      id: 'landcover_wetland',
      type: 'fill',
      'source-layer': 'landcover',
      paint: { 'fill-pattern': 'wetland_bg_11', 'fill-opacity': 0.8 },
    },
    {
      id: 'road_motorway_casing',
      type: 'line',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      paint: { 'line-color': '#e9ac77', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 20, 30] },
    },
    {
      id: 'road_motorway',
      type: 'line',
      'source-layer': 'transportation',
      filter: ['==', ['get', 'class'], 'motorway'],
      paint: { 'line-color': '#fc8', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0, 20, 24], 'line-opacity': 0.5 },
    },
    {
      id: 'road_minor',
      type: 'line',
      'source-layer': 'transportation',
      filter: ['match', ['get', 'class'], ['minor', 'service'], true, false],
      paint: { 'line-color': '#fff', 'line-width': 2 },
    },
    { id: 'road_path_pedestrian', type: 'line', 'source-layer': 'transportation', paint: { 'line-color': '#fff', 'line-width': 1 } },
    { id: 'road_major_rail', type: 'line', 'source-layer': 'transportation', filter: ['==', ['get', 'class'], 'rail'], paint: { 'line-color': '#bbb' } },
    { id: 'building', type: 'fill', 'source-layer': 'building', paint: { 'fill-color': '#ddd', 'fill-outline-color': '#ccc' } },
    { id: 'building-3d', type: 'fill-extrusion', 'source-layer': 'building', paint: { 'fill-extrusion-color': '#ddd' } },
    { id: 'boundary_2', type: 'line', 'source-layer': 'boundary', paint: { 'line-color': '#a37', 'line-width': 2 } },
    {
      id: 'highway-shield-us-interstate',
      type: 'symbol',
      'source-layer': 'transportation_name',
      layout: { 'icon-image': 'us-interstate', 'text-field': '{ref}' },
    },
    {
      id: 'poi_r1',
      type: 'symbol',
      'source-layer': 'poi',
      minzoom: 14,
      layout: { 'icon-image': '{class}', 'text-field': '{name}', 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#666' },
    },
    {
      id: 'label_other',
      type: 'symbol',
      'source-layer': 'place',
      filter: ['match', ['get', 'class'], ['city', 'continent', 'country', 'state', 'town', 'village'], false, true],
      layout: { 'text-field': '{name}' },
    },
    {
      id: 'label_city',
      type: 'symbol',
      'source-layer': 'place',
      layout: { 'icon-image': 'circle_11', 'text-field': '{name}', 'text-font': ['Noto Sans Regular'] },
      paint: { 'text-color': '#333', 'text-halo-color': '#fff' },
    },
    { id: 'mystery_layer', type: 'line', 'source-layer': 'some_new_thing', paint: { 'line-color': 'red', 'line-width': 3 } },
  ],
}

const byId = (s: MapStyle, id: string) => s.layers.find((l) => l.id === id)!
const ids = (s: MapStyle) => s.layers.map((l) => l.id)

describe('classifyLayer', () => {
  it('matches by type / source-layer / class, not id lists', () => {
    const roles = Object.fromEntries(fixture.layers.map((l) => [l.id, classifyLayer(l)]))
    expect(roles).toMatchObject({
      background: 'background',
      natural_earth: 'raster',
      park: 'park',
      water: 'water',
      landcover_wetland: 'landcover',
      road_motorway_casing: 'road-casing',
      road_motorway: 'road-major',
      road_minor: 'road-minor',
      road_path_pedestrian: 'road-path',
      road_major_rail: 'rail',
      building: 'building',
      'building-3d': 'building-3d',
      boundary_2: 'boundary',
      'highway-shield-us-interstate': 'hidden-symbol',
      poi_r1: 'poi',
      label_other: 'label-region',
      label_city: 'label-place',
      mystery_layer: 'other',
    })
  })
})

describe('pipMapStyle', () => {
  const hue = 135
  const p = pipPalette(hue)
  const out = pipMapStyle(fixture, hue)

  it('keeps sources, glyphs and sprite and does not mutate the input', () => {
    expect((out.sources as Record<string, unknown>).openmaptiles).toBe((fixture.sources as Record<string, unknown>).openmaptiles)
    expect(out.glyphs).toBe(fixture.glyphs)
    expect(out.sprite).toBe(fixture.sprite)
    expect(byId(fixture, 'water').paint).toEqual({ 'fill-color': 'rgb(158,189,255)' })
    for (const l of fixture.layers) expect(ids(out)).toContain(l.id)
  })

  it('paints dim green land, with water darker than the land', () => {
    expect(byId(out, 'background').paint).toEqual({ 'background-color': p.land })
    expect(p.bg).toBe('rgb(4,16,7)')
    const water = hatchPixels(hue)
    const land = p.land.match(/\d+/g)!.map(Number)
    expect(water.data[1 * 4 + 1]).toBeLessThan(land[1]) // off-rule water pixel, green channel
  })

  it('hatches water with the pattern image, or dims it without', () => {
    expect(byId(out, 'water').paint?.['fill-pattern']).toBe(HATCH_ID)
    const flat = pipMapStyle(fixture, hue, { hatch: false })
    expect(byId(flat, 'water').paint?.['fill-pattern']).toBeUndefined()
    expect(byId(flat, 'water').paint?.['fill-color']).toBe(p.bg)
  })

  it('drops sprite patterns from landcover', () => {
    expect(byId(out, 'landcover_wetland').paint?.['fill-pattern']).toBeUndefined()
  })

  it('keeps roads faint so icons dominate, keeps class-based widths, etches casings', () => {
    const motorway = byId(out, 'road_motorway')
    expect(motorway.paint?.['line-color']).toBe(p.a(0.26))
    expect(motorway.paint?.['line-width']).toEqual(byId(fixture, 'road_motorway').paint?.['line-width'])
    expect(motorway.paint?.['line-opacity']).toBeUndefined()
    expect(byId(out, 'road_minor').paint?.['line-color']).toBe(p.a(0.12))
    expect(byId(out, 'road_motorway_casing').paint?.['line-color']).toBe(p.land)
    expect(byId(out, 'road_path_pedestrian').paint?.['line-dasharray']).toBeDefined()
  })

  it('draws buildings as thin outlines and hides 3D extrusions', () => {
    expect(byId(out, 'building').paint?.['fill-outline-color']).toBe(p.a(0.14))
    expect(byId(out, 'building-3d').layout?.visibility).toBe('none')
  })

  it('uppercases labels with a glow halo and strips icons', () => {
    const city = byId(out, 'label_city')
    expect(city.layout?.['text-transform']).toBe('uppercase')
    expect(city.layout?.['icon-image']).toBeUndefined()
    expect(city.layout?.['text-font']).toEqual(['Noto Sans Regular'])
    expect(city.paint?.['text-color']).toBe(p.a(0.8))
    expect(city.paint?.['text-halo-color']).toBe(p.shadow)
  })

  it('hides upstream POIs and neighbourhood labels (replaced by Pip layers)', () => {
    expect(byId(out, 'poi_r1').layout?.visibility).toBe('none')
    expect(byId(out, 'label_other').layout?.visibility).toBe('none')
    expect(byId(out, 'park').layout?.visibility).toBe('none')
  })

  it('hides shields and the shaded-relief raster', () => {
    expect(byId(out, 'highway-shield-us-interstate').layout?.visibility).toBe('none')
    expect(byId(out, 'natural_earth').layout?.visibility).toBe('none')
  })

  it('dims unknown layers instead of dropping them', () => {
    const m = byId(out, 'mystery_layer')
    expect(m.paint?.['line-color']).toBe(p.a(0.2))
    expect(m.paint?.['line-width']).toBe(3)
  })

  it('adds the GeoJSON sources the overlays draw from', () => {
    const src = out.sources as Record<string, { type: string }>
    expect(src.openmaptiles).toBe((fixture.sources as Record<string, unknown>).openmaptiles)
    expect(src[WAYPOINT_SOURCE].type).toBe('geojson')
    expect(src[ACTIVE_ROI_SOURCE].type).toBe('geojson')
  })

  it('puts regions of interest under the roads and the icon field on top', () => {
    const order = ids(out)
    const roi = order.indexOf('pip-roi-fill')
    expect(roi).toBeGreaterThan(order.indexOf('park'))
    expect(roi).toBeLessThan(order.indexOf('water'))
    expect(roi).toBeLessThan(order.indexOf('road_motorway'))
    expect(byId(out, 'pip-roi-fill').paint?.['fill-pattern']).toBe(ROI_HATCH_ID)
    expect(byId(out, 'pip-roi-park-fill').paint?.['fill-pattern']).toBe(ROI_DOTS_ID)
    expect(byId(out, 'pip-roi-line').paint?.['line-dasharray']).toBeDefined()
    const top = order.slice(-POI_LAYERS.length)
    expect([...top].sort()).toEqual([...POI_LAYERS].sort())
    expect(order.indexOf(REGION_LABEL_LAYER)).toBeLessThan(order.indexOf('pip-poi-1'))
  })

  it('styles POIs as tinted, glowing, collision-aware SDF icons', () => {
    const poi = byId(out, 'pip-poi-1')
    expect(poi['source-layer']).toBe('poi')
    expect(poi.layout?.['icon-allow-overlap']).toBe(false)
    expect(poi.layout?.['text-field']).toBeUndefined()
    expect(poi.paint?.['icon-color']).toBe(p.pip)
    expect(poi.paint?.['icon-halo-color']).toBe(p.a(0.55))
    expect(byId(out, 'pip-poi-3').minzoom).toBeGreaterThan(byId(out, 'pip-poi-1').minzoom!)
  })

  it('writes valid filters and expressions for the overlay layers', () => {
    const named = (props: Record<string, unknown>) => ({ type: 1, properties: props }) as never
    const f1 = featureFilter(byId(out, 'pip-poi-1').filter as never, 'layers[0].filter')
    const f3 = featureFilter(byId(out, 'pip-poi-3').filter as never, 'layers[0].filter')
    expect(f1.filter({ zoom: 15 }, named({ name: 'Diner', class: 'restaurant', rank: 2 }))).toBe(true)
    expect(f1.filter({ zoom: 15 }, named({ name: 'Lot', class: 'parking', rank: 2 }))).toBe(false)
    expect(f1.filter({ zoom: 15 }, named({ class: 'restaurant', rank: 2 }))).toBe(false)
    expect(f1.filter({ zoom: 15 }, named({ name: 'Diner', class: 'restaurant', rank: 40 }))).toBe(false)
    expect(f3.filter({ zoom: 17 }, named({ name: 'Diner', class: 'restaurant', rank: 40 }))).toBe(true)
    const size = createExpression(byId(out, 'pip-poi-1').layout?.['icon-size'], 'layers[0].layout.icon-size')
    expect(size.result).toBe('success')
  })

  it('brightens the active region label', () => {
    expect(byId(out, REGION_LABEL_LAYER).paint?.['text-color']).toBe(p.a(0.38))
    const active = regionLabelColor(hue, 'Downtown')
    const e = createExpression(active, 'layers[0].paint.text-color')
    if (e.result !== 'success') throw new Error('bad expression')
    const at = (name: string) => e.value.evaluate({ zoom: 14 }, { type: 'Point', properties: { name } } as never)
    expect(at('Downtown').toString()).not.toBe(at('Back Bay').toString())
  })

  it('follows the hue', () => {
    const amber = pipMapStyle(fixture, 40)
    expect(byId(amber, 'road_motorway').paint?.['line-color']).not.toBe(byId(out, 'road_motorway').paint?.['line-color'])
  })
})

describe('huePaintUpdates', () => {
  it('lists only color props of visible layers', () => {
    const ups = huePaintUpdates(fixture, 200)
    expect(ups.every((u) => u.prop.endsWith('-color'))).toBe(true)
    expect(ups.find((u) => u.id === 'building-3d')).toBeUndefined()
    expect(ups).toContainEqual({ id: 'background', prop: 'background-color', value: pipPalette(200).land })
    expect(ups.find((u) => u.id === 'water')).toBeUndefined() // pattern, updated via updateImage
    expect(ups).toContainEqual({ id: 'pip-poi-1', prop: 'icon-color', value: pipPalette(200).pip })
  })
})

describe('patternImages', () => {
  it('covers every pattern the style references', () => {
    const imgs = patternImages(135)
    expect(Object.keys(imgs).sort()).toEqual([HATCH_ID, ROI_DOTS_ID, ROI_HATCH_ID].sort())
  })
  it('keeps region hatches mostly transparent', () => {
    const img = roiHatchPixels(135, 10)
    const alphas = Array.from(img.data.filter((_, i) => i % 4 === 3))
    expect(alphas.filter((a) => a === 0).length).toBeGreaterThan(alphas.length * 0.8)
  })
})

describe('hatchPixels', () => {
  it('is an opaque square with a diagonal rule', () => {
    const img = hatchPixels(135, 8)
    expect(img.data).toHaveLength(8 * 8 * 4)
    const px = (x: number, y: number) => Array.from(img.data.slice((y * 8 + x) * 4, (y * 8 + x) * 4 + 4))
    expect(px(0, 0)).not.toEqual(px(1, 0))
    expect(px(3, 5)).toEqual(px(0, 0)) // (3+5) % 8 === 0 → on the rule
    expect(img.data.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true)
  })
})
