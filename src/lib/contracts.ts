/**
 * Shared contracts between the shell (lead) and feature branches.
 * Feature branches import from here and MUST NOT change these signatures.
 * See BUILD-PLAN.md §3.1.
 */
export { useStored, resetAll, persistence } from './store'
export { emit, on, type AppEvent } from './events'
export { openOverlay, closeOverlay, useOverlay, type OverlayId } from './overlay'
export { usePageVisible, usePrefersReducedMotion, useCoarsePointer, useMediaQuery } from './hooks'
export { useProfile, useSettings, type Profile, type Settings } from './profile'
export { hashString, mulberry32, rngFrom, randInt, type Rng } from './seed'
export { useEffectsConfig } from '../effects/EffectsProvider'
export { triggerGlitch } from '../effects/glitchScheduler'
export { pipRgb, hslToRgb } from '../effects/color'
export type { EffectsConfig } from '../effects/types'

/** Props every overlay component receives (default export of its module). */
export type OverlayProps = { payload?: unknown; onClose: () => void }

/** Status bar feeds. Each owner replaces its stub body; the signature stays. */
export type BatteryStatus = { level: number; charging: boolean } // features/device/useBattery.ts (P3)
export type XpStatus = { xp: number; level: number; progress: number } // features/quests/useXp.ts (P4)
export type Daylight = { remaining: number; total: number } // features/clock/useDaylight.ts (P3), minutes
// features/terminal/useCaps.ts (P5): () => number
