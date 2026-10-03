import { useEffect } from 'react'
import { useStored } from '../../lib/contracts'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { GLITCH_GOAL, NO_PERKS, NO_PROGRESS, PERKS, PERKS_KEY, PROGRESS_KEY, startPerkTracking, type PerkProgress } from './perks'

export default function PerksPanel() {
  useEffect(startPerkTracking, [])
  const [earned] = useStored<string[]>(PERKS_KEY, NO_PERKS)
  const [progress] = useStored<PerkProgress>(PROGRESS_KEY, NO_PROGRESS)
  const [selected, setSelected] = useStored<string>('perks:selected', PERKS[0].id)

  // Earned perks float to the top, the rest keep catalogue order.
  const sorted = [...PERKS.filter((p) => earned.includes(p.id)), ...PERKS.filter((p) => !earned.includes(p.id))]
  const items: ListItem[] = sorted.map((p) => ({
    id: p.id,
    label: (
      <>
        <span className="perk-mark" aria-hidden>{earned.includes(p.id) ? '■' : '□'}</span> {p.name}
      </>
    ),
    right: earned.includes(p.id) ? 'EARNED' : 'LOCKED',
  }))
  const perk = PERKS.find((p) => p.id === selected) ?? sorted[0]
  const has = earned.includes(perk.id)
  const extra =
    perk.id === 'static-cling' && !has
      ? `${Math.min(progress.glitches, GLITCH_GOAL)}/${GLITCH_GOAL} WITNESSED`
      : perk.id === 'tourist' && !has
        ? `${progress.tabs.filter((t) => t !== 'STAT').length}/4 SECTIONS VISITED`
        : null

  return (
    <ListDetail
      label="Perks"
      items={items}
      selected={perk.id}
      onSelect={setSelected}
      detail={
        <div className={`perk-detail pip-frame${has ? ' is-earned' : ''}`}>
          <h2 className="pip-frame__title">{perk.name}</h2>
          <PerkBadge name={perk.name} earned={has} />
          <p className="perk-detail__state">{has ? 'RANK 1 · EARNED' : 'LOCKED'}</p>
          <p>{has ? perk.desc : perk.hint}</p>
          {extra && <p className="pip-note">{extra}</p>}
          <p className="pip-note">
            {earned.length}/{PERKS.length} PERKS EARNED THIS SESSION
          </p>
        </div>
      }
    />
  )
}

/** Original stamped badge: a gear ring with the perk initials. */
function PerkBadge({ name, earned }: { name: string; earned: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
  const teeth = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg className="perk-badge" viewBox="0 0 100 100" aria-hidden>
      <g opacity={earned ? 1 : 0.35}>
        {teeth.map((a) => (
          <rect key={a} x="45" y="4" width="10" height="12" transform={`rotate(${a} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="36" className="perk-badge__ring" />
        <circle cx="50" cy="50" r="28" className="perk-badge__inner" />
        <text x="50" y="60" textAnchor="middle">
          {earned ? initials : '?'}
        </text>
      </g>
    </svg>
  )
}
