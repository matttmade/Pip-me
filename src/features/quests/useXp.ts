import { useMemo } from 'react'
import { useStored } from '../../lib/store'
import { XP_KEY } from './state'
import { xpToLevel } from './xp'

/** LEVEL + XP bar in the status bar. progress is 0-1. Reads the XP banked by QUESTS. */
export function useXp(): { xp: number; level: number; progress: number } {
  const [xp] = useStored<number>(XP_KEY, 0)
  return useMemo(() => ({ xp, ...xpToLevel(xp) }), [xp])
}
