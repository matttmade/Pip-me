/** Pure tab navigation used by the keyboard and swipe handlers. */
export type Nav = { tab: number; subs: number[] }

const mod = (n: number, m: number) => ((n % m) + m) % m

/**
 * ← / →: step through sub-tabs; past the first/last sub-tab, continue into the previous/next
 * top tab (landing on its last/first sub-tab), wrapping around the whole Pip-Boy.
 */
export function stepSection(nav: Nav, counts: number[], dir: 1 | -1): Nav {
  const sub = Math.min(nav.subs[nav.tab] ?? 0, counts[nav.tab] - 1)
  const next = sub + dir
  const subs = [...nav.subs]
  if (next >= 0 && next < counts[nav.tab]) {
    subs[nav.tab] = next
    return { tab: nav.tab, subs }
  }
  const tab = mod(nav.tab + dir, counts.length)
  subs[tab] = dir === 1 ? 0 : counts[tab] - 1
  return { tab, subs }
}

/** Shift + ← / →: jump whole top tabs, keeping each tab's remembered sub-tab. */
export const stepTab = (nav: Nav, count: number, dir: 1 | -1): Nav => ({ ...nav, tab: mod(nav.tab + dir, count) })

export type SectionMove = { tab: number; sub: number; dir: 'next' | 'prev'; kind: 'tab' | 'sub' }

/**
 * Which way a section change went, for the transition: a new top tab is a 'tab' move, else
 * 'sub'. Wrapping from the last top tab to the first (or back) still reads as forward (or back).
 */
export function sectionMove(prev: SectionMove, tab: number, sub: number, tabCount: number): SectionMove {
  if (prev.tab === tab && prev.sub === sub) return prev
  const wrapped = tabCount > 2 && Math.abs(tab - prev.tab) === tabCount - 1
  const forward = tab !== prev.tab ? tab > prev.tab : sub > prev.sub
  return { tab, sub, dir: forward !== wrapped ? 'next' : 'prev', kind: tab !== prev.tab ? 'tab' : 'sub' }
}
