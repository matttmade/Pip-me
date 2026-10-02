/**
 * Pure headshot crop math (no DOM). The crop is a square window on the source image:
 * `x`/`y` are the window centre as a fraction of image width/height, `scale` is zoom
 * (1 = the largest square that fits, 4 = a quarter of that side).
 */
export type Crop = { x: number; y: number; scale: number }
export type CropRect = { sx: number; sy: number; sw: number; sh: number; dx: number; dy: number; dw: number; dh: number }

export const MIN_SCALE = 1
export const MAX_SCALE = 4
export const CENTER_CROP: Crop = { x: 0.5, y: 0.5, scale: 1 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function assertSize(w: number, h: number) {
  if (!(w > 0 && h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) throw new RangeError(`bad image size ${w}x${h}`)
}

/** Side length of the crop window in source pixels. */
export function cropSide(w: number, h: number, scale: number): number {
  return Math.min(w, h) / clamp(scale, MIN_SCALE, MAX_SCALE)
}

/** Clamp zoom to [MIN_SCALE, MAX_SCALE] and keep the window fully inside the image. */
export function clampCrop(w: number, h: number, crop: Crop): Crop {
  assertSize(w, h)
  const scale = clamp(Number.isFinite(crop.scale) ? crop.scale : 1, MIN_SCALE, MAX_SCALE)
  const side = Math.min(w, h) / scale
  const hx = side / 2 / w
  const hy = side / 2 / h
  return {
    x: clamp(Number.isFinite(crop.x) ? crop.x : 0.5, hx, 1 - hx),
    y: clamp(Number.isFinite(crop.y) ? crop.y : 0.5, hy, 1 - hy),
    scale,
  }
}

/** drawImage() arguments that copy the crop window into an `out`×`out` square. */
export function computeCropRect(imgW: number, imgH: number, crop: Crop, out: number): CropRect {
  const c = clampCrop(imgW, imgH, crop)
  const side = cropSide(imgW, imgH, c.scale)
  return { sx: c.x * imgW - side / 2, sy: c.y * imgH - side / 2, sw: side, sh: side, dx: 0, dy: 0, dw: out, dh: out }
}

/** Screen pixels per source pixel when the crop window fills a `viewport`-px square. */
export const displayScale = (w: number, h: number, crop: Crop, viewport: number) => viewport / cropSide(w, h, crop.scale)

/** Drag by (dx, dy) screen px in a `viewport`-px guide: the image follows the pointer. */
export function panCrop(w: number, h: number, crop: Crop, dx: number, dy: number, viewport: number): Crop {
  const ds = displayScale(w, h, crop, viewport)
  return clampCrop(w, h, { ...crop, x: crop.x - dx / ds / w, y: crop.y - dy / ds / h })
}

/** Multiply zoom by `factor`, keeping the window centre where it is (then clamped). */
export function zoomCrop(w: number, h: number, crop: Crop, factor: number): Crop {
  return clampCrop(w, h, { ...crop, scale: crop.scale * factor })
}
