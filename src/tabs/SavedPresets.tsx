import { useState } from 'react'
import { useDeviceSettings } from '../device/deviceSettings'
import { useEffectsConfig } from '../effects/EffectsProvider'
import { useSettings } from '../lib/profile'
import { useStored } from '../lib/store'
import {
  applySnapshot,
  captureSnapshot,
  decodePreset,
  encodePreset,
  makePreset,
  nextPresetName,
  PRESETS_KEY,
  sameSnapshot,
  type SavedPreset,
} from '../lib/systemPresets'

const fmtDate = (t: number) => new Date(t).toLocaleDateString([], { month: 'short', day: '2-digit' }).toUpperCase()

/** DATA > SYSTEM > SAVED PRESETS: save the whole SYSTEM setup under a name, load, share, delete. */
export function SavedPresets() {
  // subscribe so the ACTIVE marker follows live changes from SYSTEM, the dock and the knobs
  useEffectsConfig()
  useDeviceSettings()
  useSettings()
  const [presets, setPresets] = useStored<SavedPreset[]>(PRESETS_KEY, [])
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [shared, setShared] = useState<{ id: string; code: string } | null>(null)
  const [importText, setImportText] = useState('')
  const [message, setMessage] = useState('')
  const current = captureSnapshot()

  const save = () => {
    const finalName = name.trim() || nextPresetName(presets)
    const existing = presets.find((p) => p.name === finalName.toUpperCase())
    const fresh = makePreset(finalName, current)
    setPresets(existing ? presets.map((p) => (p.id === existing.id ? { ...fresh, id: existing.id } : p)) : [...presets, fresh])
    setName('')
    setMessage(existing ? `${fresh.name} UPDATED.` : `${fresh.name} SAVED.`)
  }

  const share = async (p: SavedPreset) => {
    const code = encodePreset(p)
    setShared({ id: p.id, code })
    try {
      await navigator.clipboard.writeText(code)
      setMessage('CODE COPIED TO CLIPBOARD.')
    } catch {
      setMessage('COPY THE CODE BELOW.')
    }
  }

  const doImport = () => {
    const got = decodePreset(importText)
    if (!got) return setMessage('INVALID CODE. CODES START WITH PIPME1.')
    const taken = presets.some((p) => p.name === got.name)
    setPresets([...presets, makePreset(taken ? `${got.name} 2` : got.name, got.snapshot)])
    setImportText('')
    setMessage(`${got.name} IMPORTED.`)
  }

  return (
    <div className="saved-presets">
      <div className="saved-presets__save">
        <label className="pip-field">
          <span>NAME</span>
          <input
            value={name}
            maxLength={24}
            placeholder={nextPresetName(presets)}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <button className="pip-btn" onClick={save}>
          [ SAVE CURRENT ]
        </button>
      </div>

      {presets.length === 0 ? (
        <p className="pip-note">NO SAVED PRESETS. TUNE THE DISPLAY, COLOR, DEVICE AND PREFERENCES, THEN SAVE THEM HERE.</p>
      ) : (
        <ul className="saved-presets__list">
          {presets.map((p) => {
            const active = sameSnapshot(p.snapshot, current)
            return (
              <li key={p.id} className={`saved-preset${active ? ' is-active' : ''}`}>
                <span className="saved-preset__swatch" style={{ background: `hsl(${p.snapshot.effects.hue} 100% 55%)` }} aria-hidden />
                <span className="saved-preset__name">
                  {p.name}
                  <small>
                    {p.snapshot.effects.preset} · {fmtDate(p.createdAt)}
                    {active ? ' · ACTIVE' : ''}
                  </small>
                </span>
                <span className="saved-preset__actions">
                  <button className={`pip-btn${active ? ' is-active' : ''}`} onClick={() => (applySnapshot(p.snapshot), setMessage(`${p.name} LOADED.`))}>
                    LOAD
                  </button>
                  <button className="pip-btn" onClick={() => share(p)}>
                    SHARE
                  </button>
                  <button
                    className="pip-btn pip-btn--danger"
                    onClick={() => {
                      if (confirmDelete !== p.id) return setConfirmDelete(p.id)
                      setPresets(presets.filter((x) => x.id !== p.id))
                      setConfirmDelete(null)
                      setMessage(`${p.name} DELETED.`)
                    }}
                  >
                    {confirmDelete === p.id ? 'SURE?' : 'DEL'}
                  </button>
                </span>
                {shared?.id === p.id && <input className="saved-preset__code" readOnly value={shared.code} onFocus={(e) => e.target.select()} aria-label={`${p.name} share code`} />}
              </li>
            )
          })}
        </ul>
      )}

      <div className="saved-presets__import">
        <label className="pip-field">
          <span>IMPORT CODE</span>
          <input value={importText} placeholder="PIPME1.…" onChange={(e) => setImportText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doImport()} />
        </label>
        <button className="pip-btn" onClick={doImport} disabled={!importText.trim()}>
          [ IMPORT ]
        </button>
      </div>
      {message && (
        <p className="pip-note" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
