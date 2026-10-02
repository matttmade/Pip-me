import type { EffectsConfig, EffectsPatch, PresetName } from './types'

type Look = Omit<EffectsConfig, 'preset' | 'hue'>

export const HUES = { GREEN: 135, AMBER: 38, BLUE: 200, TEAL: 160, LCD: 85 } as const
export const DEFAULT_HUE = HUES.GREEN

export const PRESETS: Record<Exclude<PresetName, 'CUSTOM'>, Look> = {
  OFF: {
    scanlines: { on: false, opacity: 0, density: 3, speed: 0 },
    noise: { on: false, amount: 0, fps: 0 },
    glitch: { on: false, frequency: 8, strength: 0, rgbSplit: false },
    flicker: { on: false, amount: 0 },
    rollBar: { on: false, interval: 8 },
    glow: 0.5,
    vignette: 0,
    curvature: 0,
  },
  SUBTLE: {
    scanlines: { on: true, opacity: 0.15, density: 3, speed: 6 },
    noise: { on: true, amount: 0.04, fps: 12 },
    glitch: { on: true, frequency: 20, strength: 0.15, rgbSplit: false },
    flicker: { on: false, amount: 0 },
    rollBar: { on: false, interval: 10 },
    glow: 0.8,
    vignette: 0.35,
    curvature: 0.4,
  },
  CLASSIC: {
    scanlines: { on: true, opacity: 0.25, density: 3, speed: 10 },
    noise: { on: true, amount: 0.07, fps: 18 },
    glitch: { on: true, frequency: 8, strength: 0.35, rgbSplit: false },
    flicker: { on: true, amount: 0.02 },
    rollBar: { on: true, interval: 8 },
    glow: 1,
    vignette: 0.55,
    curvature: 0.6,
  },
  DAMAGED: {
    scanlines: { on: true, opacity: 0.35, density: 4, speed: 18 },
    noise: { on: true, amount: 0.14, fps: 24 },
    glitch: { on: true, frequency: 3, strength: 0.8, rgbSplit: true },
    flicker: { on: true, amount: 0.05 },
    rollBar: { on: true, interval: 4 },
    glow: 1,
    vignette: 0.75,
    curvature: 0.7,
  },
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** A full config for a named preset. Hue is a color choice, so it is carried over. */
export function applyPreset(name: PresetName, hue: number = DEFAULT_HUE, current?: EffectsConfig): EffectsConfig {
  if (name === 'CUSTOM') return { ...(current ?? applyPreset('CLASSIC', hue)), preset: 'CUSTOM', hue }
  return { preset: name, hue, ...clone(PRESETS[name]) }
}

export const DEFAULT_EFFECTS: EffectsConfig = applyPreset('CLASSIC')

/**
 * Apply a patch. Picking a preset loads it; changing hue keeps the preset;
 * touching any other knob switches the preset to CUSTOM.
 */
export function patchConfig(cfg: EffectsConfig, patch: EffectsPatch): EffectsConfig {
  const hue = patch.hue ?? cfg.hue
  if (patch.preset && patch.preset !== cfg.preset && patch.preset !== 'CUSTOM') {
    return applyPreset(patch.preset, hue)
  }
  const next = { ...cfg, hue } as Record<string, unknown>
  let touched = false
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'preset' || k === 'hue' || v === undefined) continue
    touched = true
    const prev = next[k]
    next[k] = typeof prev === 'object' && prev !== null ? { ...prev, ...(v as object) } : v
  }
  const out = next as EffectsConfig
  if (touched) out.preset = 'CUSTOM'
  return out
}

/** Motion-free variant for prefers-reduced-motion: keeps the look, drops movement. */
export function stillVersion(cfg: EffectsConfig): EffectsConfig {
  return {
    ...cfg,
    scanlines: { ...cfg.scanlines, speed: 0 },
    noise: { ...cfg.noise, fps: 0 },
    glitch: { ...cfg.glitch, on: false },
    flicker: { ...cfg.flicker, on: false },
    rollBar: { ...cfg.rollBar, on: false },
  }
}

/** Fill any missing or malformed fields of a stored config from defaults, so bad storage can't crash the app. */
export function normalizeConfig(raw: unknown, fallback: EffectsConfig = DEFAULT_EFFECTS): EffectsConfig {
  if (!raw || typeof raw !== 'object') return fallback
  const r = raw as Record<string, unknown>
  const out = { ...fallback } as Record<string, unknown>
  for (const k of Object.keys(fallback) as (keyof EffectsConfig)[]) {
    const def = fallback[k]
    const v = r[k]
    if (def && typeof def === 'object') out[k] = v && typeof v === 'object' ? { ...def, ...(v as object) } : def
    else if (v !== undefined && typeof v === typeof def) out[k] = v
  }
  return out as EffectsConfig
}
