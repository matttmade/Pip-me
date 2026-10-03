import { expect, test } from 'vitest'
import { stepSection, stepTab } from './nav'

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
