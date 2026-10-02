import { useEffect, useRef } from 'react'
import { useCoarsePointer, usePageVisible } from '../lib/hooks'
import { pipRgb } from './color'
import { useEffectsConfig } from './EffectsProvider'

const TILE = 128

/**
 * Film grain: a 128px tile of tinted noise regenerated at noise.fps and tiled across a
 * half-resolution canvas. "back" sits behind content, "front" is a fainter copy on top.
 */
export function NoiseLayer({ placement }: { placement: 'back' | 'front' }) {
  const [cfg] = useEffectsConfig()
  const visible = usePageVisible()
  const coarse = useCoarsePointer()
  const ref = useRef<HTMLCanvasElement>(null)
  const { on, amount } = cfg.noise
  const fps = coarse ? Math.min(cfg.noise.fps, 12) : cfg.noise.fps
  const active = on && amount > 0

  useEffect(() => {
    const canvas = ref.current
    if (!active || !canvas) return
    const ctx = canvas.getContext('2d')
    const tile = document.createElement('canvas')
    tile.width = tile.height = TILE
    const tctx = tile.getContext('2d')
    if (!ctx || !tctx) return
    const img = tctx.createImageData(TILE, TILE)
    const [r, g, b] = pipRgb(cfg.hue, 0.6)

    const resize = () => {
      canvas.width = Math.ceil(canvas.clientWidth / 2)
      canvas.height = Math.ceil(canvas.clientHeight / 2)
    }
    const draw = () => {
      const d = img.data
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random()
        d[i] = r * v
        d[i + 1] = g * v
        d[i + 2] = b * v
        d[i + 3] = 255
      }
      tctx.putImageData(img, 0, 0)
      const pattern = ctx.createPattern(tile, 'repeat')
      if (!pattern) return
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    resize()
    draw()
    const ro = new ResizeObserver(() => (resize(), draw()))
    ro.observe(canvas)
    const timer = visible && fps > 0 ? window.setInterval(draw, 1000 / fps) : undefined
    return () => {
      ro.disconnect()
      window.clearInterval(timer)
    }
  }, [active, fps, cfg.hue, visible])

  if (!active) return null
  const opacity = placement === 'back' ? Math.min(1, amount * 1.5) : amount
  return <canvas ref={ref} className={`fx-noise fx-noise--${placement}`} style={{ opacity }} aria-hidden />
}
