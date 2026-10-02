import QuestsPanel from '../features/quests/QuestsPanel'
import StatsPanel from '../features/clock/StatsPanel'
import { SystemPanel } from './SystemPanel'

export function DataTab({ sub }: { sub: string }) {
  return sub === 'QUESTS' ? <QuestsPanel /> : sub === 'STATS' ? <StatsPanel /> : <SystemPanel />
}
