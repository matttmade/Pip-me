/**
 * Layout math for the two views. Pure, so it is unit-tested.
 * SCREEN: the CRT fills the viewport. ARM: the user's photo composite (background, arm,
 * Pip-Boy) with the live screen pinned onto the Pip-Boy's glass.
 */
export type Rect = { x: number; y: number; w: number; h: number }
export type Insets = { top: number; right: number; bottom: number; left: number }
export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/** Source image sizes (px) and the glass opening measured on pipboy.webp. */
export const PIPBOY = { w: 1651, h: 1193 }
export const GLASS = { x: 321, y: 175, w: 767, h: 598, r: 88 }
/** How far the screen extends under the bezel lip (Pip-Boy px), so the edges tuck in. */
export const BLEED = 10
export const ARM = { w: 2400, h: 954 }
export const BG = { w: 2400, h: 1340 }
/** Arm placement in Pip-Boy pixels: scale relative to the Pip-Boy and top-left offset. */
export const ARM_FIT = { k: 1.26, x: -895, y: 184 }
/** The UI is laid out at this fixed size in ARM view and scaled onto the glass. */
export const DESIGN = { w: 640, h: Math.round((640 * (GLASS.h + 20)) / (GLASS.w + 20)) }

export const DOCK_SPACE = 84 // px reserved under the device for the glass dock (ON ARM view)
export const isCompact = (vw: number) => vw < 700

export function screenRect(vw: number, vh: number, safe: Insets = NO_INSETS): Rect {
  // phones in either orientation (landscape phones are wide but short)
  const compact = isCompact(vw) || vh < 520
  const m = compact ? 10 : 18
  // top/bottom also hold the rim labels (ROBCO INDUSTRIES / Pip-Me logo) centred on the rim line
  const top = compact ? 16 : 22
  const bottom = compact ? 22 : 26
  return {
    x: safe.left + m,
    y: safe.top + top,
    w: Math.max(200, vw - safe.left - safe.right - 2 * m),
    h: Math.max(200, vh - safe.top - safe.bottom - top - bottom),
  }
}

export type ArmLayout = {
  scale: number
  pipboy: Rect
  glass: Rect & { r: number }
  /** the screen, relative to the Pip-Boy box, slightly larger than the glass so it tucks under the bezel */
  screen: Rect & { r: number }
  arm: Rect
  uiScale: number
}

export function armLayout(vw: number, vh: number): ArmLayout {
  const usableH = vh - DOCK_SPACE
  const pw = Math.min(vw * 0.72, (usableH * 0.98 * PIPBOY.w) / PIPBOY.h)
  const s = pw / PIPBOY.w
  // center the glass (not the whole casing) in the usable area
  const gcx = GLASS.x + GLASS.w / 2
  const gcy = GLASS.y + GLASS.h / 2
  const px = vw / 2 - gcx * s
  const py = Math.max(usableH / 2 - gcy * s + 8, usableH - PIPBOY.h * s)
  const pipboy = { x: px, y: py, w: PIPBOY.w * s, h: PIPBOY.h * s }
  const glass = { x: px + GLASS.x * s, y: py + GLASS.y * s, w: GLASS.w * s, h: GLASS.h * s, r: GLASS.r * s }
  const arm = { x: px + ARM_FIT.x * s, y: py + ARM_FIT.y * s, w: ARM.w * ARM_FIT.k * s, h: ARM.h * ARM_FIT.k * s }
  const screen = {
    x: (GLASS.x - BLEED) * s,
    y: (GLASS.y - BLEED) * s,
    w: (GLASS.w + 2 * BLEED) * s,
    h: (GLASS.h + 2 * BLEED) * s,
    r: (GLASS.r + BLEED) * s,
  }
  return { scale: s, pipboy, glass, screen, arm, uiScale: screen.w / DESIGN.w }
}
