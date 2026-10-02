/** Pure layout math for the device and the IN/OUT camera. All units are CSS px. */
export type Insets = { top: number; right: number; bottom: number; left: number }
export type DeviceLayout = {
  orientation: 'landscape' | 'portrait'
  screen: { x: number; y: number; w: number; h: number } // inside the device
  device: { w: number; h: number }
  bezel: number
  bezelTop: number
  panel: { x: number; y: number; w: number; h: number }
}
export type Camera = { x: number; y: number; scale: number }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
export const MAX_SCREEN = { w: 1180, h: 860 }

export function layoutDevice(vw: number, vh: number, safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 }): DeviceLayout {
  const compact = vw < 700
  const m = compact ? 6 : 28
  const availW = vw - safe.left - safe.right
  const availH = vh - safe.top - safe.bottom
  const bezelTop = compact ? 40 : 52
  const screenW = Math.round(Math.min(availW - 2 * m, MAX_SCREEN.w))
  const screenH = Math.round(Math.min(availH - bezelTop - m, MAX_SCREEN.h))
  const bezel = Math.round(clamp(Math.min(screenW, screenH) * 0.05, 16, 44))
  const orientation = availW >= availH ? 'landscape' : 'portrait'
  const screen = { x: bezel, y: bezelTop, w: screenW, h: screenH }
  if (orientation === 'landscape') {
    const pw = Math.round(clamp(screenH * 0.3, 170, 250))
    const panel = { x: bezel + screenW + bezel, y: bezelTop, w: pw, h: screenH }
    return { orientation, screen, bezel, bezelTop, panel, device: { w: panel.x + pw + bezel, h: bezelTop + screenH + bezel } }
  }
  const ph = Math.round(clamp(screenW * 0.62, 220, 300))
  const panel = { x: bezel, y: bezelTop + screenH + bezel, w: screenW, h: ph }
  return { orientation, screen, bezel, bezelTop, panel, device: { w: screenW + 2 * bezel, h: panel.y + ph + bezel } }
}

/** IN: screen + top bezel fill the viewport at 1:1. OUT: the whole device fits. */
export function cameraFor(mode: 'in' | 'out', L: DeviceLayout, vw: number, vh: number, safe: Insets): Camera {
  const cx = safe.left + (vw - safe.left - safe.right) / 2
  const cy = safe.top + (vh - safe.top - safe.bottom) / 2
  if (mode === 'in') {
    const focusX = L.screen.x + L.screen.w / 2
    const focusY = (L.screen.y + L.screen.h) / 2 // top bezel edge → screen bottom
    return { x: cx - focusX, y: cy - focusY, scale: 1 }
  }
  const pad = vw < 700 ? 12 : 40
  const scale = Math.min((vw - safe.left - safe.right - 2 * pad) / L.device.w, (vh - safe.top - safe.bottom - 2 * pad) / L.device.h, 1)
  return { x: cx - (L.device.w / 2) * scale, y: cy - (L.device.h / 2) * scale, scale }
}
