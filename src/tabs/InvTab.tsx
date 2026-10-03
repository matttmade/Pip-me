import { useMemo } from 'react'
import { useProfile } from '../lib/profile'
import { useStored } from '../lib/store'
import AidPanel from '../features/holotapes/AidPanel'
import HolotapesPanel from '../features/holotapes/HolotapesPanel'
import { AID_KEY, HOLOTAPES_KEY, NO_AID, NO_HOLOTAPES, type Holotape } from '../features/holotapes/types'
import { aidWgVal, carryCapacity, fmtWg, holotapeWgVal, noteWgVal, ROBCO_WGVAL, totals } from '../features/holotapes/weight'
import NotesPanel from '../features/notes/NotesPanel'
import { NO_NOTES, NOTES_KEY, type Note } from '../features/notes/notes'
import { generateSpecial } from '../features/special/generateSpecial'
import { useCaps } from '../features/terminal/useCaps'
import ToolsPanel from '../features/tools/ToolsPanel'
import { TOOLS } from '../features/tools/tools'

export function InvTab({ sub }: { sub: string }) {
  const panel =
    sub === 'TOOLS' ? <ToolsPanel /> : sub === 'NOTES' ? <NotesPanel /> : sub === 'AID' ? <AidPanel /> : <HolotapesPanel />
  return (
    <div className="inv-tab">
      <div className="inv-tab__body">{panel}</div>
      <InvReadout />
    </div>
  )
}

/** FO4-style carry readout: total weight against capacity (from Strength), total value, caps. */
function InvReadout() {
  const [tapes] = useStored<Holotape[]>(HOLOTAPES_KEY, NO_HOLOTAPES)
  const [aid] = useStored(AID_KEY, NO_AID)
  const [notes] = useStored<Note[]>(NOTES_KEY, NO_NOTES)
  const [profile] = useProfile()
  const caps = useCaps()
  const cap = useMemo(() => carryCapacity(generateSpecial(profile.name).S), [profile.name])
  const sum = useMemo(
    () => totals([ROBCO_WGVAL, ...tapes.map(holotapeWgVal), ...aid.map(aidWgVal), ...TOOLS.map((t) => t.wgVal), ...notes.map(noteWgVal)]),
    [tapes, aid, notes],
  )
  const over = sum.wg > cap
  return (
    <p className={`inv-readout${over ? ' is-over' : ''}`} aria-label={`Carry weight ${fmtWg(sum.wg)} of ${cap}, value ${sum.val}, caps ${caps}`}>
      <span>
        WG {fmtWg(sum.wg)}/{cap}
        {over && <b> OVERENCUMBERED</b>}
      </span>
      <span>VAL {sum.val}</span>
      <span>CAPS {caps}</span>
    </p>
  )
}
