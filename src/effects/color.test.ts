import { expect, test } from 'vitest'
import { hslToRgb } from './color'

test('primary hues', () => {
  expect(hslToRgb(0, 1, 0.5)).toEqual([255, 0, 0])
  expect(hslToRgb(120, 1, 0.5)).toEqual([0, 255, 0])
  expect(hslToRgb(240, 1, 0.5)).toEqual([0, 0, 255])
  expect(hslToRgb(0, 0, 1)).toEqual([255, 255, 255])
})
