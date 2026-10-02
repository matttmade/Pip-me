import { useEffect, useRef, useState, type FormEvent } from 'react'
import { emit } from '../../lib/events'
import { useStored } from '../../lib/store'
import { triggerGlitch } from '../../lib/contracts'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { Facts, InvDetail } from '../holotapes/ui'
import { fmtDate, useNotice } from '../holotapes/util'
import { QUESTS_KEY, SEED_QUESTS, XP_KEY, newQuestId, type Quest } from './state'
import { DIFFICULTIES, XP_REWARD, xpForLevel, xpToLevel, type Difficulty } from './xp'

const NEW = '__new'
const DIVIDER = '__done'

export default function QuestsPanel() {
  const [quests, setQuests] = useStored<Quest[]>(QUESTS_KEY, SEED_QUESTS)
  const [xp, setXp] = useStored<number>(XP_KEY, 0)
  const [stored, setSelected] = useStored<string>('quests:selected', '')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [levelUp, setLevelUp] = useState<number | null>(null)
  const [notice, showNotice] = useNotice(2500)
  const levelTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(levelTimer.current), [])

  const active = quests.filter((q) => !q.completedAt)
  const done = quests.filter((q) => q.completedAt).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
  const { level } = xpToLevel(xp)

  const items: ListItem[] = active.map((q) => ({ id: q.id, label: q.title, right: `${XP_REWARD[q.difficulty]} XP` }))
  if (done.length) {
    items.push({ id: DIVIDER, label: <span className="quest-divider">COMPLETED</span>, disabled: true })
    for (const q of done) {
      items.push({
        id: q.id,
        label: (
          <span className="quest-done">
            <span className="quest-check" aria-hidden>
              ✓
            </span>
            {q.title}
          </span>
        ),
        right: <span className="quest-done">+{XP_REWARD[q.difficulty]}</span>,
      })
    }
  }

  const selectable = items.filter((i) => !i.disabled)
  const selected = stored === NEW || selectable.some((i) => i.id === stored) ? stored : (selectable[0]?.id ?? NEW)
  const current = quests.find((q) => q.id === selected)

  const select = (id: string) => {
    setSelected(id)
    setConfirmDelete(null)
  }

  const complete = (q: Quest) => {
    if (q.completedAt) return
    const reward = XP_REWARD[q.difficulty]
    const next = xp + reward
    setQuests((prev) => prev.map((p) => (p.id === q.id ? { ...p, completedAt: Date.now() } : p)))
    setXp(next)
    emit({ type: 'quest-complete', xp: reward })
    showNotice(`QUEST COMPLETED  +${reward} XP`)
    const after = xpToLevel(next).level
    if (after > level) {
      emit({ type: 'level-up', level: after })
      triggerGlitch(0.6)
      setLevelUp(after)
      clearTimeout(levelTimer.current)
      levelTimer.current = setTimeout(() => setLevelUp(null), 2200)
    }
    // move the cursor to the next open quest, if any
    const nextActive = active.find((a) => a.id !== q.id)
    if (nextActive) select(nextActive.id)
  }

  const remove = (q: Quest) => {
    if (confirmDelete !== q.id) return setConfirmDelete(q.id)
    const idx = selectable.findIndex((i) => i.id === q.id)
    const neighbour = selectable[idx + 1] ?? selectable[idx - 1]
    setQuests((prev) => prev.filter((p) => p.id !== q.id))
    select(neighbour?.id ?? NEW)
    showNotice(q.completedAt ? 'LOG ENTRY DELETED' : 'QUEST ABANDONED')
  }

  const add = (title: string, difficulty: Difficulty) => {
    const id = newQuestId()
    setQuests((prev) => [...prev, { id, title, difficulty, createdAt: Date.now() }])
    select(id)
    showNotice('QUEST ACCEPTED')
  }

  let detail
  if (selected === NEW || !current) {
    detail = <NewQuest onAdd={add} onCancel={active[0] ? () => select(active[0].id) : undefined} />
  } else {
    const isDone = !!current.completedAt
    detail = (
      <InvDetail title={current.title} sub={isDone ? 'COMPLETED' : 'ACTIVE'}>
        <Facts
          rows={[
            ['DIFFICULTY', current.difficulty],
            ['REWARD', `${XP_REWARD[current.difficulty]} XP`],
            [isDone ? 'COMPLETED' : 'ACCEPTED', isDone || current.createdAt ? fmtDate(isDone ? current.completedAt : current.createdAt) : 'VAULT ISSUE'],
          ]}
        />
        <div className="pip-choices">
          {!isDone && (
            <button className="pip-btn is-active" onClick={() => complete(current)}>
              [ COMPLETE ]
            </button>
          )}
          <button className={`pip-btn pip-btn--danger${confirmDelete === current.id ? ' is-active' : ''}`} onClick={() => remove(current)}>
            {confirmDelete === current.id ? '[ CONFIRM ]' : isDone ? '[ DELETE ]' : '[ ABANDON ]'}
          </button>
        </div>
      </InvDetail>
    )
  }

  const toNext = xpForLevel(level + 1) - xp

  return (
    <div className="inv-panel">
      <div className="inv-toolbar">
        <button className={`pip-btn${selected === NEW ? ' is-active' : ''}`} onClick={() => select(NEW)}>
          [ + NEW QUEST ]
        </button>
        <span className="quest-xp">
          LVL {level} // {xp} XP
        </span>
      </div>
      <p className="inv-status" role="status">
        {notice ?? `${active.length} ACTIVE // ${toNext} XP TO LEVEL ${level + 1}`}
      </p>
      <div className="inv-body">
        <ListDetail label="Quests" items={items} selected={selected} onSelect={select} detail={detail} empty="NO ACTIVE QUESTS" />
      </div>
      {levelUp != null && (
        <div className="level-up" role="alert">
          <span className="level-up__title">LEVEL UP!</span>
          <span className="level-up__sub">YOU REACHED LEVEL {levelUp}</span>
        </div>
      )}
    </div>
  )
}

function NewQuest({ onAdd, onCancel }: { onAdd: (title: string, d: Difficulty) => void; onCancel?: () => void }) {
  const [title, setTitle] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY')
  const [error, setError] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    if (!t) return setError(true)
    onAdd(t, difficulty)
    setTitle('')
  }

  return (
    <InvDetail title="NEW QUEST">
      <form className="inv-form" onSubmit={submit} noValidate>
        <label className="pip-field">
          <span>OBJECTIVE</span>
          <input value={title} maxLength={60} onChange={(e) => (setTitle(e.target.value), setError(false))} placeholder="WHAT NEEDS DOING?" aria-invalid={error} />
        </label>
        {error && <p className="inv-error">OBJECTIVE REQUIRED.</p>}
        <div className="pip-choices" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={difficulty === d}
              className={`pip-btn${difficulty === d ? ' is-active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {d} {XP_REWARD[d]}
            </button>
          ))}
        </div>
        <div className="pip-choices">
          <button className="pip-btn is-active" type="submit">
            [ ACCEPT QUEST ]
          </button>
          {onCancel && (
            <button className="pip-btn" type="button" onClick={onCancel}>
              [ CANCEL ]
            </button>
          )}
        </div>
      </form>
    </InvDetail>
  )
}
