export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'

export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']
export const XP_REWARD: Record<Difficulty, number> = { EASY: 10, MEDIUM: 25, HARD: 50 }

/** Total XP needed to reach level n (level 1 = 0, 2 = 50, 3 = 150, 4 = 300...). */
export const xpForLevel = (n: number): number => (50 * n * (n - 1)) / 2

export function xpToLevel(xp: number): { level: number; progress: number } {
  const total = Math.max(0, Number.isFinite(xp) ? xp : 0)
  let level = 1
  while (xpForLevel(level + 1) <= total) level++
  const lo = xpForLevel(level)
  const hi = xpForLevel(level + 1)
  return { level, progress: (total - lo) / (hi - lo) }
}
