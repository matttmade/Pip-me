import { describe, expect, it, test } from 'vitest'
import { sectionMove, stepSection, stepTab } from './nav'

const counts = [3, 2, 3, 1, 1] // STAT INV DATA MAP RADIO

test('arrows move through sub-tabs, then spill into neighbouring tabs', () => {
  let n = { tab: 0, subs: [0, 0, 0, 0, 0] }
  n = stepSection(n, counts, 1)
  expect(n).toEqual({ tab: 0, subs: [1, 0, 0, 0, 0] })
  n = stepSection(stepSection(n, counts, 1), counts, 1) // past PERKS -> INV/HOLOTAPES
  expect(n.tab).toBe(1)
  expect(n.subs[1]).toBe(0)
  n = stepSection(n, counts, -1) // back to STAT, last sub
  expect(n.tab).toBe(0)
  expect(n.subs[0]).toBe(2)
})

test('wraps around the whole device', () => {
  const start = { tab: 0, subs: [0, 0, 0, 0, 0] }
  const back = stepSection(start, counts, -1)
  expect(back.tab).toBe(4)
  const end = { tab: 4, subs: [0, 0, 0, 0, 0] }
  expect(stepSection(end, counts, 1).tab).toBe(0)
})

test('shift jumps tabs and keeps remembered sub-tabs', () => {
  const n = { tab: 2, subs: [1, 0, 2, 0, 0] }
  expect(stepTab(n, 5, 1)).toEqual({ tab: 3, subs: [1, 0, 2, 0, 0] })
  expect(stepTab({ ...n, tab: 0 }, 5, -1).tab).toBe(4)
})

describe('sectionMove', () => {
  const at = (tab: number, sub: number) => ({ tab, sub, dir: 'next' as const, kind: 'sub' as const })
  it('keeps the same object when nothing moved', () => {
    const p = at(1, 2)
    expect(sectionMove(p, 1, 2, 5)).toBe(p)
  })
  it('reads sub-tab steps by direction', () => {
    expect(sectionMove(at(0, 0), 0, 1, 5)).toMatchObject({ dir: 'next', kind: 'sub' })
    expect(sectionMove(at(0, 2), 0, 1, 5)).toMatchObject({ dir: 'prev', kind: 'sub' })
  })
  it('reads top-tab moves, wrapping around the ends', () => {
    expect(sectionMove(at(1, 0), 2, 0, 5)).toMatchObject({ dir: 'next', kind: 'tab' })
    expect(sectionMove(at(2, 0), 1, 3, 5)).toMatchObject({ dir: 'prev', kind: 'tab' })
    expect(sectionMove(at(4, 0), 0, 0, 5)).toMatchObject({ dir: 'next', kind: 'tab' })
    expect(sectionMove(at(0, 0), 4, 0, 5)).toMatchObject({ dir: 'prev', kind: 'tab' })
  })
})
