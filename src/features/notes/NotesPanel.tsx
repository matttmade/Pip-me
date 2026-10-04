import { useMemo, useState, type FormEvent } from 'react'
import { emit } from '../../lib/events'
import { useStored } from '../../lib/store'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { colHead } from '../holotapes/colHead'
import { Cols, Facts, InvDetail } from '../holotapes/ui'
import { fmtDate, useNotice } from '../holotapes/util'
import { noteWgVal } from '../holotapes/weight'
import { BODY_MAX, newNoteId, NO_NOTES, NOTES_KEY, notesReducer, searchNotes, TITLE_MAX, wordCount, type Note, type NoteAction } from './notes'

const NEW = '__new'
const EMPTY = '__empty'
const clock = () => Date.now()

export default function NotesPanel() {
  const [notes, setNotes] = useStored<Note[]>(NOTES_KEY, NO_NOTES)
  const [stored, setSelected] = useStored<string>('notes:selected', '')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [notice, showNotice] = useNotice()

  const dispatch = (a: NoteAction) => setNotes((prev) => notesReducer(prev, a))
  const filtered = useMemo(() => searchNotes(notes, query), [notes, query])

  const items: ListItem[] = filtered.length
    ? [colHead('ENTRY'), ...filtered.map((n) => ({ id: n.id, label: n.title, right: <Cols wgVal={noteWgVal(n)} /> }))]
    : [{ id: EMPTY, label: query ? 'NO MATCHES' : 'NO ENTRIES RECORDED', disabled: true }]

  const selected = editing === NEW ? NEW : filtered.some((n) => n.id === stored) ? stored : filtered[0]?.id
  const current = notes.find((n) => n.id === selected)

  const select = (id: string) => {
    setSelected(id)
    setEditing(null)
    setConfirmDelete(null)
  }

  const save = (title: string, body: string) => {
    const now = clock()
    if (editing === NEW) {
      const id = newNoteId(now)
      dispatch({ type: 'add', id, title, body, now })
      setSelected(id)
      showNotice('ENTRY RECORDED')
      emit({ type: 'list-select' })
    } else if (current) {
      dispatch({ type: 'update', id: current.id, title, body, now })
      showNotice('ENTRY UPDATED')
    }
    setQuery('')
    setEditing(null)
  }

  const remove = (n: Note) => {
    if (confirmDelete !== n.id) return setConfirmDelete(n.id)
    const idx = filtered.findIndex((x) => x.id === n.id)
    const next = filtered[idx + 1] ?? filtered[idx - 1]
    dispatch({ type: 'delete', id: n.id })
    select(next?.id ?? '')
    showNotice('ENTRY ERASED')
  }

  let detail
  if (editing) {
    const base = editing === NEW ? undefined : current
    detail = <NoteEditor key={editing} note={base} onSave={save} onCancel={() => setEditing(null)} />
  } else if (current) {
    detail = (
      <InvDetail title={current.title} sub={`LOGGED ${fmtDate(current.createdAt)}`} icon="note" wgVal={noteWgVal(current)} stats={[['WORDS', wordCount(current.body)]]}>
        {current.body.trim() ? <p className="note-body">{current.body}</p> : <p className="inv-empty">BLANK ENTRY.</p>}
        <Facts rows={[['LAST EDIT', fmtDate(current.updatedAt)]]} />
        <div className="pip-choices">
          <button className="pip-btn is-active" onClick={() => setEditing(current.id)}>
            [ EDIT ]
          </button>
          <button className={`pip-btn pip-btn--danger${confirmDelete === current.id ? ' is-active' : ''}`} onClick={() => remove(current)}>
            {confirmDelete === current.id ? '[ CONFIRM ERASE ]' : '[ ERASE ]'}
          </button>
        </div>
      </InvDetail>
    )
  } else {
    detail = (
      <InvDetail title="NOTES" icon="note">
        <p className="inv-empty">
          {query ? 'NOTHING MATCHES THAT SEARCH.' : 'NO ENTRIES YET. [ NEW ] STARTS ONE. NOTES STAY ON THIS DEVICE, EVEN AFTER THE BROWSER CLOSES.'}
        </p>
      </InvDetail>
    )
  }

  return (
    <div className="inv-panel">
      <div className="inv-toolbar">
        <button className={`pip-btn${editing === NEW ? ' is-active' : ''}`} onClick={() => (setEditing(NEW), setConfirmDelete(null))}>
          [ NEW ]
        </button>
        <label className="inv-search">
          <span aria-hidden>&gt;</span>
          <input
            type="search"
            placeholder="SEARCH"
            aria-label="Search notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), e.currentTarget.blur())}
          />
        </label>
      </div>
      <p className="inv-status" role="status">
        {notice ?? `${notes.length} ENTR${notes.length === 1 ? 'Y' : 'IES'} // SAVED ON THIS DEVICE${query ? ` // ${filtered.length} MATCH${filtered.length === 1 ? '' : 'ES'}` : ''}`}
      </p>
      <div className="inv-body">
        <ListDetail
          label="Notes"
          items={items}
          selected={selected}
          onSelect={select}
          onActivate={(id) => id !== EMPTY && setEditing(id)}
          detail={detail}
        />
      </div>
    </div>
  )
}

function NoteEditor({ note, onSave, onCancel }: { note?: Note; onSave: (title: string, body: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(note?.title ?? '')
  const [body, setBody] = useState(note?.body ?? '')
  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!title.trim() && !body.trim()) return onCancel()
    onSave(title, body)
  }
  return (
    <InvDetail title={note ? 'EDIT ENTRY' : 'NEW ENTRY'} icon="note" stats={[['WORDS', wordCount(body)]]}>
      <form
        className="inv-form"
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e)
        }}
      >
        <label className="pip-field">
          <span>TITLE</span>
          <input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder="OPTIONAL" autoFocus={!note} />
        </label>
        <label className="pip-field">
          <span>ENTRY</span>
          <textarea className="note-input" value={body} maxLength={BODY_MAX} rows={7} onChange={(e) => setBody(e.target.value)} autoFocus={!!note} />
        </label>
        <div className="pip-choices">
          <button className="pip-btn is-active" type="submit">
            [ SAVE ]
          </button>
          <button className="pip-btn" type="button" onClick={onCancel}>
            [ CANCEL ]
          </button>
        </div>
      </form>
    </InvDetail>
  )
}
