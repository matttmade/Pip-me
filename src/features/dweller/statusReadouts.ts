/**
 * The four readout boxes under the STATUS figure (FO4's weapon/armor boxes, re-purposed):
 * TEMP, RADS, CAPS, QUESTS. Pure formatting + where each box leads.
 */

export type ReadoutId = 'temp' | 'rads' | 'caps' | 'quests'
export type Readout = { id: ReadoutId; label: string; value: string; sub: string; dim: boolean }

export type ReadoutInput = {
  weather: { temp: number; uv: number; units: 'F' | 'C' } | null
  weatherStatus: 'idle' | 'loading' | 'ok' | 'error'
  caps: number
  activeQuests: number
}

/** UV index → a short severity word for the RADS box. */
export function radsWord(uv: number): string {
  return uv < 3 ? 'LOW' : uv < 6 ? 'MODERATE' : uv < 8 ? 'HIGH' : uv < 11 ? 'V.HIGH' : 'EXTREME'
}

export function readouts(s: ReadoutInput): Readout[] {
  const w = s.weather
  const offline = s.weatherStatus === 'error' ? 'NO SIGNAL' : 'SCANNING'
  return [
    { id: 'temp', label: 'TEMP', value: w ? `${w.temp}°${w.units}` : '--', sub: w ? 'OUTSIDE' : offline, dim: !w },
    { id: 'rads', label: 'RADS', value: w ? String(Math.round(w.uv)) : '--', sub: w ? radsWord(w.uv) : offline, dim: !w },
    { id: 'caps', label: 'CAPS', value: String(s.caps), sub: s.caps > 0 ? 'DAY STREAK' : 'HACK TODAY', dim: false },
    { id: 'quests', label: 'QUESTS', value: String(s.activeQuests), sub: s.activeQuests === 0 ? 'ALL CLEAR' : 'ACTIVE', dim: s.activeQuests === 0 },
  ]
}

/**
 * Tap-through targets as indices into App's TABS (STAT, INV, DATA, MAP, RADIO) and the
 * target tab's sub-tabs (DATA: QUESTS, STATS, SYSTEM). App keeps its nav in the shared
 * store under NAV_KEY, so jumping there is a store write, not a new API.
 */
export const NAV_KEY = 'nav'
export type Nav = { tab: number; subs: number[] }
export const NAV_TARGET: Partial<Record<ReadoutId, { tab: number; sub: number; tabId: string; subId: string }>> = {
  temp: { tab: 2, sub: 1, tabId: 'DATA', subId: 'STATS' },
  rads: { tab: 2, sub: 1, tabId: 'DATA', subId: 'STATS' },
  quests: { tab: 2, sub: 0, tabId: 'DATA', subId: 'QUESTS' },
}

/** The stored nav with `tab` selected on sub-tab `sub`. Tolerates a malformed stored value. */
export function navTo(prev: unknown, tab: number, sub: number): Nav {
  const p = prev as Partial<Nav> | null
  const subs = Array.isArray(p?.subs) ? p.subs.map((n) => (Number.isInteger(n) ? n : 0)) : []
  while (subs.length <= tab) subs.push(0)
  subs[tab] = sub
  return { tab, subs }
}
