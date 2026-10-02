import { createContext, useCallback, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '../lib/hooks'
import { useStored } from '../lib/store'
import { applyPreset, DEFAULT_EFFECTS, normalizeConfig, patchConfig, stillVersion } from './presets'
import type { EffectsConfig, EffectsPatch } from './types'

type Ctx = [EffectsConfig, (patch: EffectsPatch) => void]
const EffectsContext = createContext<Ctx | null>(null)

export function EffectsProvider({ children }: { children: ReactNode }) {
  const reduced = usePrefersReducedMotion()
  const [stored, setStored] = useStored<EffectsConfig | null>('effects', null)
  // Reduced motion is a default, not a lock: once the user edits SYSTEM, their choice wins.
  const cfg = useMemo(
    () => (stored ? normalizeConfig(stored) : reduced ? stillVersion(applyPreset('SUBTLE')) : DEFAULT_EFFECTS),
    [stored, reduced],
  )
  const update = useCallback((patch: EffectsPatch) => setStored(patchConfig(cfg, patch)), [cfg, setStored])

  useLayoutEffect(() => {
    const root = document.documentElement
    const s = root.style
    s.setProperty('--pip-hue', String(cfg.hue))
    s.setProperty('--glow-amt', String(cfg.glow))
    s.setProperty('--vignette', String(cfg.vignette))
    s.setProperty('--curve', String(cfg.curvature))
    s.setProperty('--scan-opacity', String(cfg.scanlines.opacity))
    s.setProperty('--scan-period', `${cfg.scanlines.density}px`)
    s.setProperty(
      '--scan-duration',
      cfg.scanlines.speed > 0 ? `${cfg.scanlines.density / cfg.scanlines.speed}s` : '0s',
    )
    s.setProperty('--flicker-amt', String(cfg.flicker.amount))
    s.setProperty('--roll-interval', `${cfg.rollBar.interval}s`)
    root.dataset.fxScan = String(cfg.scanlines.on && cfg.scanlines.opacity > 0)
    root.dataset.fxScanMove = String(cfg.scanlines.speed > 0)
    root.dataset.fxFlicker = String(cfg.flicker.on && cfg.flicker.amount > 0)
    root.dataset.fxRoll = String(cfg.rollBar.on)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `hsl(${cfg.hue} 60% 4%)`)
  }, [cfg])

  const value = useMemo<Ctx>(() => [cfg, update], [cfg, update])
  return <EffectsContext.Provider value={value}>{children}</EffectsContext.Provider>
}

export function useEffectsConfig(): Ctx {
  const ctx = useContext(EffectsContext)
  if (!ctx) throw new Error('useEffectsConfig must be used inside <EffectsProvider>')
  return ctx
}
