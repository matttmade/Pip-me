/**
 * STATUS weapon slot: FIST → WATER PISTOL → NUKE. Pure state (cycle, ammo + reload, the
 * nuke's two-tap launch) and the detonation timeline. No DOM, no timers; callers pass `now`.
 */

export type WeaponId = 'fist' | 'water' | 'nuke'

export type Weapon = { id: WeaponId; name: string; short: string; dmg: number; mag: number | null }

export const WEAPONS: readonly Weapon[] = [
  { id: 'fist', name: 'FIST', short: 'FIST', dmg: 2, mag: null },
  { id: 'water', name: 'WATER PISTOL', short: 'WATER GUN', dmg: 0, mag: 24 },
  { id: 'nuke', name: 'MINI NUKE', short: 'MINI NUKE', dmg: 9999, mag: null },
]

export const weaponById = (id: WeaponId): Weapon => WEAPONS.find((w) => w.id === id) ?? WEAPONS[0]

export const WEAPON_KEY = 'dweller:weapon'
/** How long the water pistol takes to refill once the tank is dry. */
export const RELOAD_MS = 1500
/** The second tap that launches the nuke must land within this window. */
export const CONFIRM_MS = 3000

export type WeaponState = {
  id: WeaponId
  /** Water pistol rounds left (kept while other weapons are equipped). */
  ammo: number
  /** Timestamp the refill finishes, while reloading. */
  reloadAt: number | null
  /** Timestamp the nuke's "tap again" window closes, while waiting for the confirm tap. */
  confirmUntil: number | null
}

export const DEFAULT_WEAPON: WeaponState = { id: 'fist', ammo: 24, reloadAt: null, confirmUntil: null }

const isId = (v: unknown): v is WeaponId => WEAPONS.some((w) => w.id === v)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Anything read back from storage → a valid state. A pending nuke confirm never survives. */
export function normalizeWeapon(v: unknown): WeaponState {
  const s = (v ?? {}) as Partial<WeaponState>
  const mag = WEAPONS[1].mag ?? 0
  const ammo = num(s.ammo)
  return {
    id: isId(s.id) ? s.id : 'fist',
    ammo: ammo == null ? mag : Math.max(0, Math.min(mag, Math.round(ammo))),
    reloadAt: num(s.reloadAt),
    confirmUntil: null,
  }
}

/** Tapping the weapon box (or W) on FIST / WATER: equip the next one. NUKE → FIST. */
export function cycleWeapon(s: WeaponState): WeaponState {
  const i = WEAPONS.findIndex((w) => w.id === s.id)
  return { ...s, id: WEAPONS[(i + 1) % WEAPONS.length].id, confirmUntil: null }
}

/** Finish a refill whose time is up. Returns the same object when nothing changed. */
export function settle(s: WeaponState, now: number): WeaponState {
  let next = s
  if (s.reloadAt != null && now >= s.reloadAt) next = { ...next, ammo: WEAPONS[1].mag ?? 0, reloadAt: null }
  if (s.confirmUntil != null && now >= s.confirmUntil) next = { ...next, id: 'fist', confirmUntil: null }
  return next
}

export const isReloading = (s: WeaponState, now: number) => s.reloadAt != null && now < s.reloadAt

export type Shot = 'squirt' | 'dry'

/**
 * Pull the water pistol's trigger. `dry` = nothing came out (empty / mid-reload).
 * Emptying the tank starts the automatic refill.
 */
export function squirt(s0: WeaponState, now: number): { state: WeaponState; shot: Shot } {
  const s = settle(s0, now)
  if (isReloading(s, now) || s.ammo <= 0) {
    const state = s.reloadAt == null ? { ...s, reloadAt: now + RELOAD_MS } : s
    return { state, shot: 'dry' }
  }
  const ammo = s.ammo - 1
  return { state: { ...s, ammo, reloadAt: ammo === 0 ? now + RELOAD_MS : s.reloadAt }, shot: 'squirt' }
}

export type NukePress = 'arm' | 'launch'

/** Tap with the NUKE equipped: the first tap asks for confirmation, a second one in time launches. */
export function pressNuke(s0: WeaponState, now: number): { state: WeaponState; result: NukePress } {
  const s = { ...s0, id: 'nuke' as const }
  if (s.confirmUntil != null && now < s.confirmUntil) return { state: { ...s, confirmUntil: null }, result: 'launch' }
  return { state: { ...s, confirmUntil: now + CONFIRM_MS }, result: 'arm' }
}

/** Whole seconds left on the confirm window (3, 2, 1), or 0 when none is open. */
export const confirmLeft = (s: WeaponState, now: number) => (s.confirmUntil == null ? 0 : Math.max(0, Math.ceil((s.confirmUntil - now) / 1000)))

/* ---------- detonation ---------- */

export type BlastPhase = 'flash' | 'cloud' | 'melt' | 'lost' | 'reboot'
export type BlastCue = { at: number; phase: BlastPhase }

/** Phase start times (ms after launch). Reduced motion: a plain fade to the reboot notice. */
export function blastTimeline(reduced: boolean): BlastCue[] {
  return reduced
    ? [
        { at: 0, phase: 'lost' },
        { at: 1600, phase: 'reboot' },
      ]
    : [
        { at: 0, phase: 'flash' },
        { at: 220, phase: 'cloud' },
        { at: 1450, phase: 'melt' },
        { at: 2150, phase: 'lost' },
        { at: 3400, phase: 'reboot' },
      ]
}

/** The phase showing `t` ms after launch. */
export function blastPhaseAt(timeline: BlastCue[], t: number): BlastPhase {
  let phase = timeline[0].phase
  for (const c of timeline) if (t >= c.at) phase = c.phase
  return phase
}

/** When the forced glitch bursts fire during a full detonation (ms). */
export const BLAST_GLITCHES = [0, 180, 520, 950, 1450, 1850] as const
