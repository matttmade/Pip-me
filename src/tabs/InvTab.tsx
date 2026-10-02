import HolotapesPanel from '../features/holotapes/HolotapesPanel'
import AidPanel from '../features/holotapes/AidPanel'

export function InvTab({ sub }: { sub: string }) {
  return sub === 'HOLOTAPES' ? <HolotapesPanel /> : <AidPanel />
}
