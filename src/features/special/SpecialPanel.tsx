import { useMemo } from 'react'
import { useProfile, useStored } from '../../lib/contracts'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { generateSpecial, SPECIAL_KEYS, specialTotal, STAT_MAX, type SpecialKey } from './generateSpecial'

// Original flavour text written for this project.
const INFO: Record<SpecialKey, { name: string; text: string; tip: string }> = {
  S: {
    name: 'STRENGTH',
    text: 'How much heavy lifting you manage before the coffee kicks in. Opens stubborn jars, hauls every grocery bag in one trip and wins arguments with vending machines.',
    tip: 'High scores carry more. Low scores make more trips.',
  },
  P: {
    name: 'PERCEPTION',
    text: 'Your knack for noticing things: a typo in someone else’s code, the quest marker you walked past, burnt toast two rooms away.',
    tip: 'Sharp eyes spot the loot everyone else missed.',
  },
  E: {
    name: 'ENDURANCE',
    text: 'Staying power. Long meetings, longer road trips and a firm refusal to close any of your forty open browser tabs.',
    tip: 'Keeps you upright when the day runs long.',
  },
  C: {
    name: 'CHARISMA',
    text: 'The pull you have on a room. Decides how often strangers ask you for directions and how well a joke survives a tough crowd.',
    tip: 'Smooth talkers pay less and hear more.',
  },
  I: {
    name: 'INTELLIGENCE',
    text: 'Book smarts and problem solving. Handy for terminal hacking, flat-pack furniture with no leftover screws, and reading the manual first.',
    tip: 'Clever dwellers learn faster from every quest.',
  },
  A: {
    name: 'AGILITY',
    text: 'Speed and coordination. Dodging puddles, catching a falling phone mid-air and slipping through the elevator doors just before they close.',
    tip: 'Quick hands, quick feet, quick exits.',
  },
  L: {
    name: 'LUCK',
    text: 'The universe’s opinion of you. Nudges everything else: green lights on the commute, the last donut in the box, a timely lucky break.',
    tip: 'Nobody knows how it works. Everybody wants more.',
  },
}

const EMPTY = 'S'

export default function SpecialPanel() {
  const [profile] = useProfile()
  const [selected, setSelected] = useStored<string>('special:selected', EMPTY)
  const special = useMemo(() => generateSpecial(profile.name), [profile.name])
  const key = (SPECIAL_KEYS as readonly string[]).includes(selected) ? (selected as SpecialKey) : 'S'
  const items: ListItem[] = SPECIAL_KEYS.map((k) => ({ id: k, label: INFO[k].name, right: special[k] }))
  const info = INFO[key]
  const value = special[key]

  return (
    <ListDetail
      label="S.P.E.C.I.A.L. attributes"
      items={items}
      selected={key}
      onSelect={setSelected}
      detail={
        <div className="special-detail">
          <h2>
            {info.name} <span className="special-detail__value">{value}</span>
          </h2>
          <div className="seg-bar" role="meter" aria-label={`${info.name} ${value} of ${STAT_MAX}`} aria-valuemin={1} aria-valuemax={STAT_MAX} aria-valuenow={value}>
            {Array.from({ length: STAT_MAX }, (_, i) => (
              <span key={i} className={i < value ? 'is-on' : undefined} />
            ))}
          </div>
          <p>{info.text}</p>
          <p className="pip-note">{info.tip}</p>
          <p className="special-detail__total">
            TOTAL {specialTotal(special)} &middot; ASSIGNED BY VAULT-TEC APTITUDE SCREENING FOR {profile.name || 'UNKNOWN'}
          </p>
        </div>
      }
    />
  )
}
