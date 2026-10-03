import { describe, expect, it } from 'vitest'
import { menuStep } from './flyout'

describe('menuStep', () => {
  it('walks away from the trigger with ArrowUp on an upward stack, wrapping', () => {
    expect(menuStep('ArrowUp', 0, 6)).toBe(1)
    expect(menuStep('ArrowUp', 5, 6)).toBe(0)
    expect(menuStep('ArrowDown', 0, 6)).toBe(5)
  })
  it('flips for a downward stack', () => {
    expect(menuStep('ArrowDown', 0, 3, 'down')).toBe(1)
    expect(menuStep('ArrowUp', 0, 3, 'down')).toBe(2)
  })
  it('keeps ←/→ inside the menu', () => {
    expect(menuStep('ArrowRight', 1, 3)).toBe(2)
    expect(menuStep('ArrowLeft', 1, 3)).toBe(0)
  })
  it('jumps with Home / End', () => {
    expect(menuStep('Home', 4, 6)).toBe(0)
    expect(menuStep('End', 0, 6)).toBe(5)
  })
  it('ignores other keys and empty menus', () => {
    expect(menuStep('Enter', 0, 6)).toBeNull()
    expect(menuStep('ArrowUp', 0, 0)).toBeNull()
  })
  it('clamps a stale index', () => {
    expect(menuStep('ArrowUp', 9, 3)).toBe(0)
    expect(menuStep('ArrowDown', -1, 3)).toBe(2)
  })
})
