import { ICON_BY_ID, ICON_IMAGE_PREFIX, ICON_VIEWBOX, type IconId } from './icons'
import { alphaToSdf, sdfToRgba } from './sdf'

/** Logical px of empty border around each glyph, room for the halo. */
const PAD = 5
const PIXEL_RATIO = 2
/** SDF falloff in image px (outside reach = 0.75 × radius). */
const RADIUS = 12

export type IconImage = { image: { width: number; height: number; data: Uint8Array }; options: { pixelRatio: number; sdf: true } }

const cache = new Map<string, IconImage>()

/**
 * Rasterize an icon's path with Canvas 2D at 2x and convert it to an SDF image
 * for map.addImage. Returns null for unknown ids or when canvas is unavailable.
 */
export function iconImage(imageId: string): IconImage | null {
  if (!imageId.startsWith(ICON_IMAGE_PREFIX)) return null
  const hit = cache.get(imageId)
  if (hit) return hit
  const icon = ICON_BY_ID[imageId.slice(ICON_IMAGE_PREFIX.length) as IconId]
  if (!icon) return null
  const size = (ICON_VIEWBOX + PAD * 2) * PIXEL_RATIO
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.setTransform(PIXEL_RATIO, 0, 0, PIXEL_RATIO, PAD * PIXEL_RATIO, PAD * PIXEL_RATIO)
    ctx.fillStyle = '#fff'
    ctx.fill(new Path2D(icon.path), icon.rule)
    const rgba = ctx.getImageData(0, 0, size, size).data
    const alpha = new Uint8Array(size * size)
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3]
    const out: IconImage = {
      image: { width: size, height: size, data: sdfToRgba(alphaToSdf(alpha, size, size, RADIUS)) },
      options: { pixelRatio: PIXEL_RATIO, sdf: true },
    }
    cache.set(imageId, out)
    return out
  } catch {
    return null
  }
}
