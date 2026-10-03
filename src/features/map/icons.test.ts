import { describe, expect, it } from 'vitest'
import { ICON_BY_ID, iconImageId, ICONS, iconSvg } from './icons'

describe('ICONS', () => {
  it('has unique ids and labels and a sensible size', () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(18)
    expect(new Set(ICONS.map((i) => i.id)).size).toBe(ICONS.length)
    expect(new Set(ICONS.map((i) => i.label)).size).toBe(ICONS.length)
  })

  it('stays on the 24×24 grid with closed, plain path data', () => {
    for (const i of ICONS) {
      expect(i.path, i.id).toMatch(/^M[\d\s.,MmLlHhVvCcSsAaZz-]+$/)
      expect(i.path.trim().endsWith('Z'), i.id).toBe(true)
      // absolute coordinates after M/L/H/V stay within the grid
      for (const m of i.path.matchAll(/[MLHV]\s*(-?[\d.]+)/g)) {
        const n = Number(m[1])
        expect(n, `${i.id}: ${m[0]}`).toBeGreaterThanOrEqual(0)
        expect(n, `${i.id}: ${m[0]}`).toBeLessThanOrEqual(24)
      }
    }
  })

  it('builds image ids and inline svg', () => {
    expect(iconImageId('fuel')).toBe('pip-i-fuel')
    expect(iconSvg('fuel', 30)).toContain(ICON_BY_ID.fuel.path)
    expect(iconSvg('fuel', 30)).toContain('width="30"')
  })
})
