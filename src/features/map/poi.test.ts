import { createExpression } from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'
import { iconImageId, ICON_BY_ID } from './icons'
import { CLASS_ICON, DEFAULT_ICON, featureToPoi, poiCategory, poiIconExpression, poiKind, poiName, SUBCLASS_ICON } from './poi'

describe('poiCategory', () => {
  it('maps common OpenMapTiles classes to icons', () => {
    expect(poiCategory('restaurant', 'restaurant')).toBe('diner')
    expect(poiCategory('cafe', 'cafe')).toBe('diner')
    expect(poiCategory('beer', 'pub')).toBe('bar')
    expect(poiCategory('place_of_worship', 'christian')).toBe('church')
    expect(poiCategory('hospital', 'clinic')).toBe('medical')
    expect(poiCategory('railway', 'subway')).toBe('transit')
    expect(poiCategory('lodging', 'hotel')).toBe('house')
    expect(poiCategory('town_hall', 'courthouse')).toBe('museum')
  })

  it('lets subclasses override the class', () => {
    expect(poiCategory('bus', 'bus_station')).toBe('transit')
    expect(poiCategory('library', 'books')).toBe('shop')
    expect(poiCategory('art_gallery', 'artwork')).toBe('monument')
    expect(poiCategory('post', 'post_office')).toBe('tower')
  })

  it('hides street clutter', () => {
    for (const [c, s] of [
      ['parking', 'parking'],
      ['bus', 'bus_stop'],
      ['gate', 'gate'],
      ['toilets', 'toilets'],
      ['post', 'post_box'],
      ['entrance', 'subway_entrance'],
      ['atm', 'atm'],
    ]) {
      expect(poiCategory(c, s), `${c}/${s}`).toBeNull()
    }
  })

  it('falls back to a landmark for unknown named things', () => {
    expect(poiCategory('something_new', 'whatever')).toBe(DEFAULT_ICON)
    expect(poiCategory(undefined)).toBe(DEFAULT_ICON)
  })

  it('only points at icons that exist', () => {
    for (const v of [...Object.values(CLASS_ICON), ...Object.values(SUBCLASS_ICON)]) if (v) expect(ICON_BY_ID[v]).toBeDefined()
  })
})

describe('poiIconExpression', () => {
  const parsed = createExpression(poiIconExpression(), 'layers[0].layout.icon-image')
  if (parsed.result !== 'success') throw new Error(JSON.stringify(parsed.value))
  const evaluate = (properties: Record<string, string>) => parsed.value.evaluate({ zoom: 15 }, { type: 'Point', properties } as never)

  it('is a valid style expression that agrees with poiCategory', () => {
    const cases: [string, string][] = [
      ...Object.keys(CLASS_ICON).map((c) => [c, c] as [string, string]),
      ...Object.keys(SUBCLASS_ICON).map((s) => ['shop', s] as [string, string]),
      ['restaurant', 'restaurant'],
      ['unknown_class', 'unknown_sub'],
    ]
    for (const [cls, subclass] of cases) {
      const want = poiCategory(cls, subclass)
      expect(evaluate({ class: cls, subclass }), `${cls}/${subclass}`).toBe(want ? iconImageId(want) : '')
    }
  })

  it('handles a missing subclass', () => {
    expect(evaluate({ class: 'museum' })).toBe(iconImageId('museum'))
  })
})

describe('featureToPoi', () => {
  const base = { id: 42, sourceLayer: 'poi', geometry: { type: 'Point', coordinates: [-71.06, 42.355] } }

  it('builds a Poi from a rendered feature', () => {
    expect(featureToPoi({ ...base, properties: { name: 'Old Corner Diner', class: 'restaurant', subclass: 'restaurant' } })).toEqual({
      key: 'poi:42',
      name: 'Old Corner Diner',
      cat: 'diner',
      lon: -71.06,
      lat: 42.355,
      cls: 'restaurant',
      subclass: 'restaurant',
    })
  })

  it('prefers the English name and keys unnamed-id features by position', () => {
    const p = featureToPoi({ ...base, id: undefined, properties: { name: 'X', 'name:en': 'Harbor Gallery', class: 'museum' } })
    expect(p?.name).toBe('Harbor Gallery')
    expect(p?.key).toBe('Harbor Gallery@-71.06000,42.35500')
  })

  it('drops unnamed, hidden or non-point features', () => {
    expect(featureToPoi({ ...base, properties: { class: 'museum' } })).toBeNull()
    expect(featureToPoi({ ...base, properties: { name: 'Lot 5', class: 'parking' } })).toBeNull()
    expect(featureToPoi({ ...base, geometry: { type: 'Polygon', coordinates: [] }, properties: { name: 'A', class: 'museum' } })).toBeNull()
  })

  it('marks aerodrome labels as airfields', () => {
    expect(featureToPoi({ ...base, sourceLayer: 'aerodrome_label', properties: { name: 'Logan', class: 'international' } })?.cat).toBe('airport')
  })
})

describe('poiName / poiKind', () => {
  it('trims and rejects blanks', () => {
    expect(poiName({ name: '  Pier 4 ' })).toBe('Pier 4')
    expect(poiName({ name: ' ' })).toBeNull()
    expect(poiName(null)).toBeNull()
  })
  it('uses the most specific tag', () => {
    expect(poiKind({ cls: 'beer', subclass: 'pub' })).toBe('PUB')
    expect(poiKind({ cls: 'fast_food', subclass: 'fast_food' })).toBe('FAST FOOD')
    expect(poiKind({})).toBeNull()
  })
})
