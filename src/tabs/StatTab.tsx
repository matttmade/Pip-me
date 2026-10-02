import { lazy } from 'react'
import { Lazy } from './Lazy'

// StatusPanel pulls in three.js, so every STAT panel is its own chunk.
const StatusPanel = lazy(() => import('../features/dweller/StatusPanel'))
const SpecialPanel = lazy(() => import('../features/special/SpecialPanel'))
const PerksPanel = lazy(() => import('../features/perks/PerksPanel'))

export function StatTab({ sub }: { sub: string }) {
  return <Lazy>{sub === 'STATUS' ? <StatusPanel /> : sub === 'SPECIAL' ? <SpecialPanel /> : <PerksPanel />}</Lazy>
}
