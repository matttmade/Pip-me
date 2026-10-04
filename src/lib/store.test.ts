import { beforeEach, expect, test } from 'vitest'
import { PREFIX, readStored, resetAll, subscribeStored, writeStored } from './store'

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  resetAll()
})

test('returns the initial value when nothing is stored', () => {
  expect(readStored('a', 5)).toBe(5)
})

test('round-trips JSON under the prefix', () => {
  writeStored('obj', { x: 1 })
  expect(JSON.parse(sessionStorage.getItem(PREFIX + 'obj')!)).toEqual({ x: 1 })
  expect(readStored('obj', null)).toEqual({ x: 1 })
})

test('supports updater functions', () => {
  writeStored('n', 1)
  writeStored<number>('n', (p) => p + 1)
  expect(readStored('n', 0)).toBe(2)
})

test('resetAll clears only prefixed keys and notifies', () => {
  sessionStorage.setItem('other', 'keep')
  writeStored('k', 'v')
  let calls = 0
  subscribeStored('k', () => calls++)
  resetAll()
  expect(sessionStorage.getItem(PREFIX + 'k')).toBeNull()
  expect(sessionStorage.getItem('other')).toBe('keep')
  expect(readStored('k', 'init')).toBe('init')
  expect(calls).toBe(1)
})

test('survives corrupt JSON', () => {
  sessionStorage.setItem(PREFIX + 'bad', '{nope')
  expect(readStored('bad', 'fallback')).toBe('fallback')
})

test('saved:* keys live in localStorage and survive resetAll', () => {
  writeStored('saved:presets', [1])
  expect(localStorage.getItem(PREFIX + 'saved:presets')).toBe('[1]')
  expect(sessionStorage.getItem(PREFIX + 'saved:presets')).toBeNull()
  writeStored('other', 1)
  resetAll()
  expect(readStored('saved:presets', [])).toEqual([1])
  expect(readStored('other', 0)).toBe(0)
})
