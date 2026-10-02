import { useStored } from '../../lib/contracts'
import { computeCropRect, type Crop } from './cropMath'

export const HEADSHOT_KEY = 'headshot'
export const HEADSHOT_SIZE = 256
export const CONTRAST = 1.15
export const PRIVACY_NOTE = 'Vault-Tec reminds you: your photo never leaves this device.'

/** The processed headshot (PNG data URL) or null for the default head. */
export const useHeadshot = () => useStored<string | null>(HEADSHOT_KEY, null)

export const isImageFile = (f: unknown): f is File => f instanceof Blob && /^image\//.test(f.type)

/**
 * Canvas wrapper around computeCropRect: crop → 256px square, contrast ×1.15,
 * circular mask with a feathered edge → PNG data URL. Runs entirely in the browser.
 */
export function processHeadshot(img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width: number; height: number }, crop: Crop, out = HEADSHOT_SIZE): string {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const r = computeCropRect(w, h, crop, out)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas unavailable')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh)

  // Contrast boost by hand (ctx.filter is not available everywhere).
  const data = ctx.getImageData(0, 0, out, out)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    px[i] = (px[i] - 128) * CONTRAST + 128
    px[i + 1] = (px[i + 1] - 128) * CONTRAST + 128
    px[i + 2] = (px[i + 2] - 128) * CONTRAST + 128
  }
  ctx.putImageData(data, 0, 0)

  // Circular mask, feathered over the outer ~6% of the radius.
  const c = out / 2
  const mask = ctx.createRadialGradient(c, c, c * 0.9, c, c, c)
  mask.addColorStop(0, 'rgba(0,0,0,1)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fillStyle = mask
  ctx.fillRect(0, 0, out, out)
  ctx.globalCompositeOperation = 'source-over'
  return canvas.toDataURL('image/png')
}
