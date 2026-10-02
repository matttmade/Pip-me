import { hslToRgb, pipRgb } from '../../lib/contracts'

/**
 * Pure helpers for the Dweller's DETAIL setting: level profiles, render-size math and the
 * smooth luma → Pip-hue tone ramp. No three.js here, so it is cheap to import and test.
 */

export type DetailLevel = 'RETRO' | 'CLEAN' | 'HI-FI'
export const DETAIL_LEVELS: readonly DetailLevel[] = ['RETRO', 'CLEAN', 'HI-FI']
export const DETAIL_KEY = 'dweller:detail'
export const DEFAULT_DETAIL: DetailLevel = 'CLEAN'

/** Anything read back from storage → a valid level (corrupt values fall back to the default). */
export const normalizeDetail = (v: unknown): DetailLevel =>
  DETAIL_LEVELS.includes(v as DetailLevel) ? (v as DetailLevel) : DEFAULT_DETAIL

export type Geometry = 'low' | 'mid' | 'high'

export type DetailProfile = {
  /** false = today's 240×320, 4-tone, Bayer-dithered look. */
  smooth: boolean
  /** Device-pixel-ratio cap for the backing canvas. */
  maxDpr: number
  /** Upper bound on backing pixels (w×h), so huge boxes don't melt phones. */
  maxPixels: number
  /** MSAA samples on the scene render target (0 = none). */
  msaa: number
  /** Bloom strength before the user's glow setting is applied (0 = no bloom pass). */
  bloom: number
  /** Fresnel rim light added to lit materials (0 = none). */
  rim: number
  geometry: Geometry
  /** Key + fill + rim studio rig instead of the basic two lights. */
  studioLights: boolean
  /** Soft floor glow with a contact shadow under the feet. */
  floor: boolean
}

export function detailProfile(level: DetailLevel, coarse = false): DetailProfile {
  switch (level) {
    case 'RETRO':
      return { smooth: false, maxDpr: 1, maxPixels: 240 * 320, msaa: 0, bloom: 0, rim: 0, geometry: 'low', studioLights: false, floor: false }
    case 'CLEAN':
      return {
        smooth: true,
        maxDpr: coarse ? 1.5 : 2,
        maxPixels: coarse ? 560_000 : 1_200_000,
        msaa: 4,
        bloom: 0.22,
        rim: 0.55,
        geometry: 'mid',
        studioLights: false,
        floor: false,
      }
    case 'HI-FI':
      return {
        smooth: true,
        maxDpr: 2,
        maxPixels: coarse ? 900_000 : 1_600_000,
        msaa: 4,
        bloom: 0.26,
        rim: 0.6,
        geometry: 'high',
        studioLights: true,
        floor: true,
      }
  }
}

export type RenderSize = { width: number; height: number; pixelRatio: number }

/**
 * Backing-store size for a CSS box: box × min(dpr, maxDpr), scaled down further if it would
 * exceed `maxPixels`. Falls back to 240×320 for an unmeasured (0-size) box.
 */
export function renderSize(boxW: number, boxH: number, dpr: number, maxDpr: number, maxPixels = Infinity): RenderSize {
  if (!(boxW > 0 && boxH > 0)) return { width: 240, height: 320, pixelRatio: 1 }
  let ratio = Math.min(Math.max(dpr || 1, 1), Math.max(maxDpr, 1))
  const budget = Math.sqrt(maxPixels / (boxW * boxH))
  if (ratio > budget) ratio = Math.max(budget, 0.5)
  return {
    width: Math.max(1, Math.round(boxW * ratio)),
    height: Math.max(1, Math.round(boxH * ratio)),
    pixelRatio: ratio,
  }
}

export type Rgb = [number, number, number]
export type RampStop = { at: number; rgb: Rgb }

/** Dark → pip → pip-hi, in the current hue. The darkest stop is the screen background. */
export function rampStops(hue: number): RampStop[] {
  return [
    { at: 0, rgb: hslToRgb(hue, 0.6, 0.04) },
    { at: 0.3, rgb: hslToRgb(hue, 0.85, 0.12) },
    { at: 0.58, rgb: pipRgb(hue, 0.34) },
    { at: 0.82, rgb: pipRgb(hue, 0.52) },
    { at: 1, rgb: pipRgb(hue, 0.78) },
  ]
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Colour at `t` ∈ [0, 1] along the ramp (smoothstep between stops, sRGB 0-255). */
export function sampleRamp(stops: RampStop[], t: number): Rgb {
  const x = Math.min(1, Math.max(0, t))
  let i = 0
  while (i < stops.length - 2 && x > stops[i + 1].at) i++
  const a = stops[i]
  const b = stops[i + 1]
  const k = smooth(b.at > a.at ? Math.min(1, Math.max(0, (x - a.at) / (b.at - a.at))) : 1)
  return [0, 1, 2].map((c) => Math.round(a.rgb[c] + (b.rgb[c] - a.rgb[c]) * k)) as Rgb
}

/** Bake the ramp into an RGBA8 strip (`size` texels) for a 1D lookup texture. */
export function bakeRamp(hue: number, size = 256): Uint8Array {
  const stops = rampStops(hue)
  const out = new Uint8Array(size * 4)
  for (let i = 0; i < size; i++) {
    const [r, g, b] = sampleRamp(stops, i / (size - 1))
    out.set([r, g, b, 255], i * 4)
  }
  return out
}

/**
 * Linear luminance → ramp coordinate. Mirrors the GLSL in pipMonochromeShader:
 * sqrt for a roughly perceptual curve, then lift so the body never sinks into the background.
 */
export const toneCoord = (luma: number, lift: number) => lift + (1 - lift) * Math.sqrt(Math.min(1, Math.max(0, luma)))

/** Scan-band period in backing pixels: one band every 3 CSS px, like the --band token. */
export const scanPeriod = (pixelRatio: number) => Math.max(2, 3 * pixelRatio)
