import { useMemo, useState } from 'react'
import { useStored } from '../../lib/store'
import { hashString } from '../../lib/seed'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { domainOf } from './parseBookmarks'
import { AID_KEY, NO_AID, type AidItem } from './types'
import { Facts, InvDetail } from './ui'
import { fmtDate, openLink } from './util'

/** Original flavor lines, picked per link so each one keeps its own. */
const FLAVOR = [
  'RESTORES 20 FOCUS',
  'CURES TAB FATIGUE',
  '+1 INT FOR 10 MINUTES',
  'REMOVES 10 BOREDOM',
  'FAST ACTING. WEARS OFF.',
  'RAD-FREE. MOSTLY.',
  '+15 MOMENTUM. HABIT FORMING.',
  'FIELD-TESTED IN VAULT LABS',
]
const flavorFor = (url: string) => FLAVOR[hashString(url) % FLAVOR.length]

export default function AidPanel() {
  const [aid, setAid] = useStored(AID_KEY, NO_AID)
  const [stored, setSelected] = useStored<string>('aid:selected', '')

  const sorted = useMemo(() => [...aid].sort((a, b) => b.uses - a.uses || a.pinnedAt - b.pinnedAt), [aid])
  const items: ListItem[] = sorted.map((a) => ({ id: a.id, label: a.title, right: `(${a.uses})` }))
  // keep the cursor on the same item while uses reorder the list
  const [fallback, setFallback] = useState(0)
  const selected = sorted.some((a) => a.id === stored) ? stored : sorted[Math.min(fallback, sorted.length - 1)]?.id
  const current = sorted.find((a) => a.id === selected)

  const use = (a: AidItem) => {
    openLink(a.url)
    setAid((prev) => prev.map((p) => (p.id === a.id ? { ...p, uses: p.uses + 1 } : p)))
  }
  const unpin = (a: AidItem) => {
    setFallback(Math.max(0, sorted.findIndex((x) => x.id === a.id)))
    setAid((prev) => prev.filter((p) => p.id !== a.id))
  }

  const detail = current ? (
    <InvDetail title={current.title} sub={flavorFor(current.url)}>
      <Facts
        rows={[
          ['SOURCE', domainOf(current.url)],
          ['DOSES TAKEN', current.uses],
          ['PINNED', fmtDate(current.pinnedAt)],
        ]}
      />
      <div className="pip-choices">
        <button className="pip-btn is-active" onClick={() => use(current)}>
          [ USE ]
        </button>
        <button className="pip-btn pip-btn--danger" onClick={() => unpin(current)}>
          [ UNPIN ]
        </button>
      </div>
    </InvDetail>
  ) : (
    <InvDetail title="AID">
      <p className="inv-empty">NO AID PINNED. SELECT A HOLOTAPE IN INV &gt; HOLOTAPES AND PIN IT FOR QUICK USE.</p>
    </InvDetail>
  )

  return (
    <div className="inv-panel">
      <p className="inv-status" role="status">
        {aid.length} ITEM{aid.length === 1 ? '' : 'S'} // SORTED BY USE
      </p>
      <div className="inv-body">
        <ListDetail
          label="Aid"
          items={items}
          selected={selected}
          onSelect={setSelected}
          onActivate={(id) => {
            const a = aid.find((x) => x.id === id)
            if (a) use(a)
          }}
          detail={detail}
          empty="NO AID PINNED"
        />
      </div>
    </div>
  )
}
