import { expect, test } from 'vitest'
import { buildCursors } from './cursors'

test('cursors are valid CSS cursor values with hotspots and fallbacks', () => {
  const c = buildCursors(135)
  expect(c.arrow).toMatch(/^url\("data:image\/svg\+xml,.+"\) 4 3, default$/)
  expect(c.hover).toMatch(/ 16 16, pointer$/)
  expect(c.drag).toMatch(/ 16 16, grabbing$/)
})

test('cursor color follows the phosphor hue', () => {
  const green = decodeURIComponent(buildCursors(135).arrow)
  const amber = decodeURIComponent(buildCursors(38).arrow)
  expect(green).not.toBe(amber)
  expect(amber).toContain('#ffa')
})
