import { useMemo, useRef, useState, type FormEvent } from 'react'
import { emit } from '../../lib/events'
import { openOverlay } from '../../lib/overlay'
import { useStored } from '../../lib/store'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { domainOf, holotapeId, mergeHolotapes, normalizeUrl, parseBookmarks } from './parseBookmarks'
import { AID_KEY, HOLOTAPES_KEY, NO_AID, NO_HOLOTAPES, type Holotape } from './types'
import { colHead } from './colHead'
import { Cols, Counted, Facts, InvDetail } from './ui'
import { holotapeWgVal, ROBCO_WGVAL, totals } from './weight'
import { fmtDate, openLink, useNotice } from './util'

const ROBCO = '__robco'
const ADD = '__add'
const EMPTY = '__empty'

export default function HolotapesPanel() {
  const [tapes, setTapes] = useStored<Holotape[]>(HOLOTAPES_KEY, NO_HOLOTAPES)
  const [aid, setAid] = useStored(AID_KEY, NO_AID)
  const [stored, setSelected] = useStored<string>('holotapes:selected', ROBCO)
  const [query, setQuery] = useState('')
  const [confirmEject, setConfirmEject] = useState<string | null>(null)
  const [notice, showNotice] = useNotice()
  const fileRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return tapes
    return tapes.filter((t) => `${t.title} ${t.url} ${t.folder}`.toLowerCase().includes(q))
  }, [tapes, query])

  const pinned = useMemo(() => new Set(aid.map((a) => a.url)), [aid])

  const items: ListItem[] = [
    colHead('HOLOTAPE'),
    { id: ROBCO, label: 'ROBCO TERMINAL', right: <Cols wgVal={ROBCO_WGVAL} extra="EXE" /> },
    ...filtered.map((t) => ({
      id: t.id,
      label: <Counted label={t.title} count={t.uses} />,
      right: <Cols wgVal={holotapeWgVal(t)} extra={pinned.has(t.url) ? '+AID' : undefined} />,
    })),
  ]
  if (!filtered.length) items.push({ id: EMPTY, label: query ? 'NO MATCHES' : 'NO HOLOTAPES LOADED', disabled: true })

  const selected = stored === ADD || items.some((i) => i.id === stored && !i.disabled) ? stored : ROBCO
  const current = tapes.find((t) => t.id === selected)

  const select = (id: string) => {
    setSelected(id)
    setConfirmEject(null)
  }

  const play = (t: Holotape) => {
    openLink(t.url)
    setTapes((prev) => prev.map((p) => (p.id === t.id ? { ...p, uses: (p.uses ?? 0) + 1 } : p)))
  }

  const activate = (id: string) => {
    if (id === ROBCO) return openOverlay('terminal')
    const t = tapes.find((x) => x.id === id)
    if (t) play(t)
  }

  const pin = (t: Holotape) => {
    if (pinned.has(t.url)) return
    setAid((prev) => [...prev, { id: t.id, title: t.title, url: t.url, uses: 0, pinnedAt: Date.now() }])
    showNotice('PINNED TO AID')
  }

  const eject = (t: Holotape) => {
    if (confirmEject !== t.id) return setConfirmEject(t.id)
    const idx = filtered.findIndex((x) => x.id === t.id)
    const next = filtered[idx + 1] ?? filtered[idx - 1]
    setTapes((prev) => prev.filter((x) => x.id !== t.id))
    select(next?.id ?? ROBCO)
    showNotice('HOLOTAPE EJECTED')
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = parseBookmarks(await file.text())
      if (!parsed.length) return showNotice('NO VALID LINKS FOUND IN FILE')
      const { list, added } = mergeHolotapes(tapes, parsed)
      setTapes(list)
      emit({ type: 'holotape-import', count: added })
      showNotice(added ? `LOADED ${added} HOLOTAPE${added === 1 ? '' : 'S'}` : 'ALL HOLOTAPES ALREADY LOADED')
    } catch {
      showNotice('READ ERROR: FILE CORRUPTED')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onAdd = (title: string, url: string) => {
    const id = holotapeId(url)
    const exists = tapes.find((t) => t.url === url)
    if (!exists) setTapes((prev) => [...prev, { id, title: title || domainOf(url), url, folder: '', addedAt: Date.now() }])
    setQuery('')
    select(exists?.id ?? id)
    showNotice(exists ? 'ALREADY LOADED' : 'HOLOTAPE RECORDED')
  }

  let detail
  if (selected === ADD) {
    detail = <AddForm onSave={onAdd} onCancel={() => select(ROBCO)} />
  } else if (current) {
    const isPinned = pinned.has(current.url)
    detail = (
      <InvDetail title={current.title} sub={domainOf(current.url)} icon="holotape" wgVal={holotapeWgVal(current)} stats={[['PLAYS', current.uses ?? 0]]}>
        <Facts
          rows={[
            ['FOLDER', current.folder || 'ROOT'],
            ['RECORDED', fmtDate(current.addedAt)],
          ]}
        />
        <div className="pip-choices">
          <button className="pip-btn" onClick={() => play(current)}>
            [ OPEN ]
          </button>
          <button className={`pip-btn${isPinned ? ' is-active' : ''}`} onClick={() => pin(current)} disabled={isPinned}>
            {isPinned ? '[ IN AID ]' : '[ PIN TO AID ]'}
          </button>
          <button className={`pip-btn pip-btn--danger${confirmEject === current.id ? ' is-active' : ''}`} onClick={() => eject(current)}>
            {confirmEject === current.id ? '[ CONFIRM EJECT ]' : '[ EJECT ]'}
          </button>
        </div>
      </InvDetail>
    )
  } else {
    detail = (
      <InvDetail title="ROBCO TERMINAL" sub="SECURITY BYPASS UTILITY // V2.77" icon="terminal" wgVal={ROBCO_WGVAL} stats={[['TYPE', 'EXE']]}>
        <p className="inv-copy">
          A memory dump hides the password among same-length decoys. Each wrong guess reports its likeness. One daily lock pays out caps; practice
          locks are unlimited.
        </p>
        <div className="pip-choices">
          <button className="pip-btn is-active" onClick={() => openOverlay('terminal')}>
            [ LOAD ]
          </button>
        </div>
        {!tapes.length && (
          <p className="inv-empty">
            NO HOLOTAPES. IMPORT YOUR BOOKMARKS (EXPORTED AS .HTML FROM YOUR BROWSER) OR ADD ONE BY HAND.
          </p>
        )}
      </InvDetail>
    )
  }

  return (
    <div className="inv-panel">
      <div className="inv-toolbar">
        <button className="pip-btn" onClick={() => fileRef.current?.click()}>
          [ IMPORT ]
        </button>
        <button className={`pip-btn${selected === ADD ? ' is-active' : ''}`} onClick={() => select(ADD)}>
          [ ADD ]
        </button>
        <label className="inv-search">
          <span aria-hidden>&gt;</span>
          <input
            type="search"
            placeholder="SEARCH"
            aria-label="Search holotapes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), e.currentTarget.blur())}
          />
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".html,.htm,text/html"
          hidden
          data-testid="holotape-import"
          onChange={(e) => void onImport(e.target.files?.[0])}
        />
      </div>
      <p className="inv-status" role="status">
        {notice ??
          `${tapes.length} HOLOTAPE${tapes.length === 1 ? '' : 'S'} // WG ${totals(tapes.map(holotapeWgVal)).wg}${query ? ` // ${filtered.length} MATCH${filtered.length === 1 ? '' : 'ES'}` : ''}`}
      </p>
      <div className="inv-body">
        <ListDetail label="Holotapes" items={items} selected={selected} onSelect={select} onActivate={activate} detail={detail} />
      </div>
    </div>
  )
}

function AddForm({ onSave, onCancel }: { onSave: (title: string, url: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const raw = url.trim()
    const href = normalizeUrl(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`)
    if (!raw || !href) return setError('INVALID ADDRESS. HTTP(S) ONLY.')
    onSave(title.trim(), href)
  }

  return (
    <InvDetail title="RECORD HOLOTAPE" icon="holotape">
      <form className="inv-form" onSubmit={submit} noValidate>
        <label className="pip-field">
          <span>TITLE</span>
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="OPTIONAL" />
        </label>
        <label className="pip-field">
          <span>ADDRESS</span>
          <input
            value={url}
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="HTTPS://"
            onChange={(e) => (setUrl(e.target.value), setError(null))}
            aria-invalid={!!error}
          />
        </label>
        {error && <p className="inv-error">{error}</p>}
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
