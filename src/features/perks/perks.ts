import { on, triggerGlitch, type AppEvent } from '../../lib/contracts'
// Module-level tracking runs outside React, so it uses the store's non-hook accessors.
import { readStored, writeStored } from '../../lib/store'

export type PerkDef = { id: string; name: string; desc: string; hint: string }
export type PerkProgress = { glitches: number; tabs: string[] }

export const PERKS_KEY = 'perks'
export const PROGRESS_KEY = 'perks:progress'
export const NO_PERKS: string[] = []
export const NO_PROGRESS: PerkProgress = { glitches: 0, tabs: [] }
export const GLITCH_GOAL = 5
const ALL_TABS = ['STAT', 'INV', 'DATA', 'MAP', 'RADIO']

// Original achievement names and copy written for this project.
export const PERKS: PerkDef[] = [
  { id: 'say-hello', name: 'SAY HELLO', desc: 'Poked your Pip-Boy companion and got a reaction. Friendliness is a survival skill.', hint: 'Tap the figure on STATUS.' },
  { id: 'good-neighbor', name: 'GOOD NEIGHBOR', desc: 'Finished your first quest. The wasteland is one chore tidier.', hint: 'Complete any quest.' },
  { id: 'moving-up', name: 'MOVING UP', desc: 'Reached level 2. The first rung is the hardest one.', hint: 'Earn enough XP to level up.' },
  { id: 'skeleton-key', name: 'SKELETON KEY', desc: 'Talked your way past a terminal password. It never stood a chance.', hint: 'Win a terminal hack.' },
  { id: 'daily-grind', name: 'DAILY GRIND', desc: 'Cracked the daily terminal. Same time tomorrow?', hint: 'Win the daily hack.' },
  { id: 'mixtape', name: 'MIXTAPE', desc: 'Loaded a holotape from the outside world. Rewind before returning.', hint: 'Import a holotape.' },
  { id: 'you-are-here', name: 'YOU ARE HERE', desc: 'Your Pip-Boy found you on the map. Hiding is now harder.', hint: 'Locate yourself on MAP.' },
  { id: 'on-the-air', name: 'ON THE AIR', desc: 'Tuned in a station. Somebody out there is still broadcasting.', hint: 'Tune a RADIO station.' },
  { id: 'static-cling', name: 'STATIC CLING', desc: `Witnessed ${GLITCH_GOAL} screen glitches and kept your cool. The display is fine. Probably.`, hint: `Sit through ${GLITCH_GOAL} glitches.` },
  { id: 'tourist', name: 'TOURIST', desc: 'Opened every section of the Pip-Boy. Thorough, if a little nosy.', hint: 'Visit all five tabs.' },
]

/**
 * Pure perk logic: given what is earned so far, the counters, and one app event,
 * return the next state. Returns the same objects when nothing changed.
 */
export function applyPerkEvent(
  earned: string[],
  progress: PerkProgress,
  e: AppEvent,
): { earned: string[]; progress: PerkProgress; newly: string[] } {
  const has = (id: string) => earned.includes(id)
  const newly: string[] = []
  const grant = (id: string) => !has(id) && !newly.includes(id) && newly.push(id)
  let next = progress

  switch (e.type) {
    case 'figure-tapped':
      grant('say-hello')
      break
    case 'quest-complete':
      grant('good-neighbor')
      break
    case 'level-up':
      if (e.level >= 2) grant('moving-up')
      break
    case 'hack-result':
      if (e.success) {
        grant('skeleton-key')
        if (e.daily) grant('daily-grind')
      }
      break
    case 'holotape-import':
      if (e.count > 0) grant('mixtape')
      break
    case 'map-located':
      grant('you-are-here')
      break
    case 'radio-tuned':
      grant('on-the-air')
      break
    case 'glitch':
      if (!has('static-cling')) {
        next = { ...next, glitches: next.glitches + 1 }
        if (next.glitches >= GLITCH_GOAL) grant('static-cling')
      }
      break
    case 'tab-change':
      if (!has('tourist') && !next.tabs.includes(e.tab)) {
        next = { ...next, tabs: [...next.tabs, e.tab] }
        // STAT is the landing tab, so it counts as visited without a tab-change event.
        if (ALL_TABS.every((t) => t === 'STAT' || next.tabs.includes(t))) grant('tourist')
      }
      break
  }
  return { earned: newly.length ? [...earned, ...newly] : earned, progress: next, newly }
}

let stop: (() => void) | null = null

/** Subscribe perk tracking to app events. Idempotent; call from boot or any panel. */
export function startPerkTracking(): void {
  if (stop) return
  stop = on('*', (e) => {
    const earned = readStored(PERKS_KEY, NO_PERKS)
    const progress = readStored(PROGRESS_KEY, NO_PROGRESS)
    const r = applyPerkEvent(earned, progress, e)
    if (r.progress !== progress) writeStored(PROGRESS_KEY, r.progress, NO_PROGRESS)
    if (r.newly.length) {
      writeStored(PERKS_KEY, r.earned, NO_PERKS)
      triggerGlitch(0.3) // a small "achievement unlocked" jolt
    }
  })
}

/** Test helper. */
export function stopPerkTracking(): void {
  stop?.()
  stop = null
}
