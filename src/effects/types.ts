export type PresetName = 'OFF' | 'SUBTLE' | 'CLASSIC' | 'DAMAGED' | 'CUSTOM'

export type EffectsConfig = {
  preset: PresetName
  scanlines: { on: boolean; opacity: number; density: number; speed: number } // density = px period, speed = px/s
  noise: { on: boolean; amount: number; fps: number } // grain strength 0-1
  glitch: { on: boolean; frequency: number; strength: number; rgbSplit: boolean } // frequency = avg seconds between glitches
  flicker: { on: boolean; amount: number }
  rollBar: { on: boolean; interval: number } // seconds
  glow: number // 0-1
  vignette: number // 0-1
  curvature: number // 0-1
  hue: number // 0-360
}

/** Nested partial: patch one field of a section without restating the rest. */
export type EffectsPatch = {
  [K in keyof EffectsConfig]?: EffectsConfig[K] extends object ? Partial<EffectsConfig[K]> : EffectsConfig[K]
}
