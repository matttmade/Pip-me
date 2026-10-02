import { CanvasTexture, SRGBColorSpace } from 'three'

const TRIM = '#f2c230'
const SUIT = '#1f4a94'

/** Number patch for the jumpsuit: yellow digits (optionally on a bordered patch). */
export class VaultDecal {
  readonly canvas = document.createElement('canvas')
  readonly texture: CanvasTexture
  private readonly patch: boolean
  constructor(patch: boolean, w = 128, h = 96) {
    this.patch = patch
    this.canvas.width = w
    this.canvas.height = h
    this.texture = new CanvasTexture(this.canvas)
    this.texture.colorSpace = SRGBColorSpace
  }

  draw(vault: string): void {
    const { canvas: c, patch } = this
    const ctx = c.getContext('2d')
    if (!ctx) return
    const text = (vault || '111').slice(0, 3)
    ctx.clearRect(0, 0, c.width, c.height)
    if (patch) {
      ctx.fillStyle = SUIT
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.strokeStyle = TRIM
      ctx.lineWidth = c.height * 0.1
      ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, c.width - ctx.lineWidth, c.height - ctx.lineWidth)
    }
    ctx.fillStyle = TRIM
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const size = c.height * (patch ? 0.62 : 0.9)
    ctx.font = `bold ${size}px monospace`
    const width = ctx.measureText(text).width
    const squeeze = Math.min(1, (c.width * 0.86) / Math.max(1, width))
    ctx.save()
    ctx.translate(c.width / 2, c.height / 2 + size * 0.04)
    ctx.scale(squeeze, 1)
    ctx.fillText(text, 0, 0)
    ctx.restore()
    this.texture.needsUpdate = true
  }

  dispose(): void {
    this.texture.dispose()
  }
}
