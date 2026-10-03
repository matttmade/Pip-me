import { expect, test } from 'vitest'
import { armLayout, DESIGN, GLASS, screenRect } from './scene'

test('screen view fills the viewport with even margins', () => {
  const r = screenRect(1440, 900)
  expect(r.x).toBe(18)
  expect(r.w).toBe(1440 - 36)
  expect(r.y + r.h).toBe(900 - 26)
  const phone = screenRect(390, 844, { top: 47, right: 0, bottom: 34, left: 0 })
  expect(phone.y).toBe(47 + 16)
  expect(phone.y + phone.h).toBe(844 - 34 - 22)
})

test('arm view keeps the glass centered and the UI scaled onto it', () => {
  for (const [w, h] of [[1440, 900], [1920, 1080], [1024, 700]]) {
    const L = armLayout(w, h)
    expect(L.glass.x + L.glass.w / 2).toBeCloseTo(w / 2, 0)
    expect(L.pipboy.x).toBeGreaterThan(0)
    expect(L.pipboy.x + L.pipboy.w).toBeLessThanOrEqual(w)
    expect(L.uiScale * DESIGN.w).toBeCloseTo(L.screen.w)
    expect(L.screen.w).toBeGreaterThan(L.glass.w)
    expect(L.glass.w / L.glass.h).toBeCloseTo(GLASS.w / GLASS.h)
    // the arm spans the full width behind the device
    expect(L.arm.x).toBeLessThanOrEqual(0)
  }
})
