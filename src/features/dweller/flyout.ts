/**
 * STATUS fly-out menus (EMOTES, WEAPON): arrow-key movement inside one. Pure; Flyout.tsx owns the DOM side.
 */

export type FlyoutId = 'emotes' | 'weapon'

/**
 * Next focused item for a key inside a menu of `count` items, or null when the key isn't
 * a menu key. Items stack away from the trigger, so with `grows: 'up'` (item 0 sits next to
 * the trigger) ArrowUp walks to the next item. ←/→ follow ↑/↓ so they never escape the menu.
 * Wraps at both ends.
 */
export function menuStep(key: string, index: number, count: number, grows: 'up' | 'down' = 'up'): number | null {
  if (count <= 0) return null
  const away = grows === 'up' ? ['ArrowUp', 'ArrowRight'] : ['ArrowDown', 'ArrowRight']
  const back = grows === 'up' ? ['ArrowDown', 'ArrowLeft'] : ['ArrowUp', 'ArrowLeft']
  const i = Math.min(Math.max(index, 0), count - 1)
  if (away.includes(key)) return (i + 1) % count
  if (back.includes(key)) return (i - 1 + count) % count
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
