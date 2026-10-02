import { useStored } from '../../lib/contracts'
import { dateKey } from './engine'
import { currentStreak, EMPTY_STREAK, type Streak } from './streak'

export const STREAK_KEY = 'hack:streak'

export const useStreak = () => useStored<Streak>(STREAK_KEY, EMPTY_STREAK)

/** CAPS in the status bar = consecutive days the daily terminal was cracked. */
export function useCaps(): number {
  const [streak] = useStreak()
  return currentStreak(streak, dateKey())
}
