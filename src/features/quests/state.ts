import type { Difficulty } from './xp'

export type Quest = {
  id: string
  title: string
  difficulty: Difficulty
  createdAt: number
  completedAt?: number
}

export const QUESTS_KEY = 'quests'
export const XP_KEY = 'xp'

/** Pre-seeded on first load (original copy). */
export const SEED_QUESTS: Quest[] = [
  { id: 'q-seed-map', title: 'Check the local map', difficulty: 'EASY', createdAt: 0 },
  { id: 'q-seed-terminal', title: "Crack today's terminal", difficulty: 'MEDIUM', createdAt: 0 },
  { id: 'q-seed-holotape', title: 'Import your holotapes', difficulty: 'EASY', createdAt: 0 },
]

export const newQuestId = () => 'q-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
