import { expect, test } from 'vitest'
import { cameraFor, layoutDevice, MAX_SCREEN } from './camera'

const none = { top: 0, right: 0, bottom: 0, left: 0 }

test('phone portrait: screen nearly full-bleed, panel below', () => {
  const L = layoutDevice(390, 844)
  expect(L.orientation).toBe('portrait')
  expect(L.screen.w).toBe(378)
  expect(L.panel.y).toBeGreaterThan(L.screen.y + L.screen.h)
  const cam = cameraFor('in', L, 390, 844, none)
  expect(cam.scale).toBe(1)
  // screen spans the viewport width with the margin
  expect(cam.x + L.screen.x).toBeCloseTo(6)
})

test('desktop landscape: screen capped, panel to the right', () => {
  const L = layoutDevice(1920, 1080)
  expect(L.orientation).toBe('landscape')
  expect(L.screen.w).toBe(MAX_SCREEN.w)
  expect(L.panel.x).toBeGreaterThan(L.screen.x + L.screen.w)
})

test('OUT camera fits the whole device in the viewport', () => {
  for (const [w, h] of [[390, 844], [1280, 800], [768, 1024]]) {
    const L = layoutDevice(w, h)
    const cam = cameraFor('out', L, w, h, none)
    expect(cam.x).toBeGreaterThanOrEqual(0)
    expect(cam.y).toBeGreaterThanOrEqual(0)
    expect(cam.x + L.device.w * cam.scale).toBeLessThanOrEqual(w + 0.01)
    expect(cam.y + L.device.h * cam.scale).toBeLessThanOrEqual(h + 0.01)
  }
})
