import type { AppEvent } from '../../lib/events'

/** What this terminal has seen since it booted (this browser session). */
export type SessionLog = {
  /** Epoch ms of boot; 0 until the tracker starts. */
  bootAt: number
  /** Distinct top tabs opened (STAT counts from the start). */
  tabs: string[]
  /** Tab + sub-tab switches. */
  switches: number
  glitches: number
  /** Quests completed on `questDay` (local YYYY-MM-DD). */
  quests: number
  questDay: string
  xp: number
  hacks: number
  hackTries: number
  tuned: number
  /** Finished radio listening, ms. */
  radioMs: number
  /** Epoch ms the current listening stretch began, null when silent. */
  radioSince: number | null
}

export const SESSION_KEY = 'session:log'
export const EMPTY_SESSION: SessionLog = {
  bootAt: 0,
  tabs: ['STAT'],
  switches: 0,
  glitches: 0,
  quests: 0,
  questDay: '',
  xp: 0,
  hacks: 0,
  hackTries: 0,
  tuned: 0,
  radioMs: 0,
  radioSince: null,
}
export const TAB_COUNT = 5

/** Local calendar day, `2026-10-03`. */
export function dayKey(epoch: number): string {
  const d = new Date(epoch)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Fold one app event into the log. Returns the same object when nothing changed. */
export function reduceSession(s: SessionLog, e: AppEvent, now: number): SessionLog {
  switch (e.type) {
    case 'tab-change':
      return { ...s, switches: s.switches + 1, tabs: s.tabs.includes(e.tab) ? s.tabs : [...s.tabs, e.tab] }
    case 'subtab-change':
      return { ...s, switches: s.switches + 1 }
    case 'glitch':
      return { ...s, glitches: s.glitches + 1 }
    case 'quest-complete': {
      const today = dayKey(now)
      const same = s.questDay === today
      return { ...s, questDay: today, quests: (same ? s.quests : 0) + 1, xp: (same ? s.xp : 0) + e.xp }
    }
    case 'hack-result':
      return { ...s, hackTries: s.hackTries + 1, hacks: s.hacks + (e.success ? 1 : 0) }
    case 'radio-tuned':
      return { ...s, tuned: s.tuned + 1 }
    default:
      return s
  }
}

/** Start or stop the radio listening clock. Returns the same object when nothing changed. */
export function radioTick(s: SessionLog, playing: boolean, now: number): SessionLog {
  if (playing && s.radioSince == null) return { ...s, radioSince: now }
  if (!playing && s.radioSince != null) return { ...s, radioMs: s.radioMs + Math.max(0, now - s.radioSince), radioSince: null }
  return s
}

/** On (re)boot: stamp the boot time, and drop a listening stretch a reload cut off. */
export function bootSession(s: SessionLog, playing: boolean, now: number): SessionLog {
  const bootAt = s.bootAt || now
  const radioSince = playing ? (s.radioSince ?? now) : null
  return bootAt === s.bootAt && radioSince === s.radioSince ? s : { ...s, bootAt, radioSince }
}

export const uptimeMs = (s: SessionLog, now: number) => (s.bootAt ? Math.max(0, now - s.bootAt) : 0)
export const listeningMs = (s: SessionLog, now: number) => s.radioMs + (s.radioSince != null ? Math.max(0, now - s.radioSince) : 0)
export const questsToday = (s: SessionLog, now: number) => (s.questDay === dayKey(now) ? s.quests : 0)
export const xpToday = (s: SessionLog, now: number) => (s.questDay === dayKey(now) ? s.xp : 0)
