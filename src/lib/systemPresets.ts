import { DEFAULT_DEVICE, type DeviceSettings } from '../device/deviceSettings'
import { DEFAULT_EFFECTS, normalizeConfig } from '../effects/presets'
import type { EffectsConfig } from '../effects/types'
import { DEFAULT_SETTINGS, type Settings } from './profile'
import { readStored, writeStored } from './store'

/**
 * Saved SYSTEM presets: a snapshot of every display/device/preference setting that can be
 * saved under a name, re-applied in one click, and shared as a short code.
 * Identity (name, vault), quests and holotapes are deliberately NOT included.
 */
export type SystemSnapshot = {
  effects: EffectsConfig
  device: DeviceSettings
  settings: Settings
  /** STAT figure options, kept as plain strings so new values don't break old presets */
  dweller?: { detail?: string; figure?: string }
}
export type SavedPreset = { id: string; name: string; createdAt: number; snapshot: SystemSnapshot }

export const PRESETS_KEY = 'saved:system-presets'
const CODE_PREFIX = 'PIPME1.'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Fill gaps / drop junk so a snapshot from storage or a pasted code is always safe to apply. */
export function normalizeSnapshot(raw: unknown): SystemSnapshot {
  const r = isObj(raw) ? raw : {}
  const device = isObj(r.device) ? r.device : {}
  const settings = isObj(r.settings) ? r.settings : {}
  const dw = isObj(r.dweller) ? r.dweller : {}
  const snap: SystemSnapshot = {
    effects: normalizeConfig(r.effects),
    device: {
      warp: typeof device.warp === 'boolean' || device.warp === null ? (device.warp as boolean | null) : DEFAULT_DEVICE.warp,
      ...(typeof device.cursor === 'boolean' ? { cursor: device.cursor } : {}),
    },
    settings: {
      units: settings.units === 'C' || settings.units === 'F' ? settings.units : DEFAULT_SETTINGS.units,
      wastelandDate: typeof settings.wastelandDate === 'boolean' ? settings.wastelandDate : DEFAULT_SETTINGS.wastelandDate,
      sound: typeof settings.sound === 'boolean' ? settings.sound : DEFAULT_SETTINGS.sound,
      volume: typeof settings.volume === 'number' ? Math.min(1, Math.max(0, settings.volume)) : DEFAULT_SETTINGS.volume,
    },
  }
  const detail = typeof dw.detail === 'string' ? dw.detail : undefined
  const figure = typeof dw.figure === 'string' ? dw.figure : undefined
  if (detail || figure) snap.dweller = { ...(detail ? { detail } : {}), ...(figure ? { figure } : {}) }
  return snap
}

/** Read the live settings into a snapshot. */
export function captureSnapshot(): SystemSnapshot {
  return normalizeSnapshot({
    effects: readStored<EffectsConfig | null>('effects', null) ?? DEFAULT_EFFECTS,
    device: readStored<DeviceSettings>('device', DEFAULT_DEVICE),
    settings: readStored<Settings>('settings', DEFAULT_SETTINGS),
    dweller: {
      detail: readStored<string | undefined>('dweller:detail', undefined),
      figure: readStored<string | undefined>('dweller:figure', undefined),
    },
  })
}

/** Apply a snapshot; every subscribed view (screen, dock, SYSTEM, STAT) updates live. */
export function applySnapshot(raw: unknown): void {
  const s = normalizeSnapshot(raw)
  writeStored('effects', s.effects)
  writeStored('device', s.device)
  writeStored('settings', s.settings)
  if (s.dweller?.detail) writeStored('dweller:detail', s.dweller.detail)
  if (s.dweller?.figure) writeStored('dweller:figure', s.dweller.figure)
}

export const sameSnapshot = (a: SystemSnapshot, b: SystemSnapshot) =>
  JSON.stringify(normalizeSnapshot(a)) === JSON.stringify(normalizeSnapshot(b))

export function makePreset(name: string, snapshot: SystemSnapshot, now = Date.now()): SavedPreset {
  const clean = name.trim().toUpperCase().slice(0, 24) || 'PRESET'
  return { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: clean, createdAt: now, snapshot: normalizeSnapshot(snapshot) }
}

/** Next free default name: PRESET 1, PRESET 2, ... */
export function nextPresetName(existing: { name: string }[]): string {
  const taken = new Set(existing.map((p) => p.name))
  for (let i = 1; ; i++) if (!taken.has(`PRESET ${i}`)) return `PRESET ${i}`
}

const toB64Url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64Url = (s: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))

/** Shareable text code for a preset (no personal data inside). */
export const encodePreset = (p: Pick<SavedPreset, 'name' | 'snapshot'>) => CODE_PREFIX + toB64Url(JSON.stringify({ n: p.name, s: p.snapshot }))

export function decodePreset(code: string): { name: string; snapshot: SystemSnapshot } | null {
  const t = code.trim()
  if (!t.startsWith(CODE_PREFIX)) return null
  try {
    const obj = JSON.parse(fromB64Url(t.slice(CODE_PREFIX.length))) as { n?: unknown; s?: unknown }
    if (!isObj(obj.s)) return null
    return { name: typeof obj.n === 'string' ? obj.n : 'IMPORTED', snapshot: normalizeSnapshot(obj.s) }
  } catch {
    return null
  }
}
