import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { openOverlay, useProfile } from '../../lib/contracts'
import { startPerkTracking } from '../perks/perks'
import { isImageFile, PRIVACY_NOTE, useHeadshot } from './headshot'
import { LIMBS, limbCondition, type Limb } from './limbs'
import PaperDollFallback from './PaperDollFallback'
import { hasWebGL } from './webgl'

// three.js only loads with the scene, in its own chunk.
const DwellerScene = lazy(() => import('./DwellerScene'))

class SceneBoundary extends Component<{ onError: (e: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    this.props.onError(err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

const slug = (l: Limb) => l.toLowerCase().replace(/\s+/g, '-')

export default function StatusPanel() {
  useEffect(startPerkTracking, [])
  const [profile] = useProfile()
  const [headshot, setHeadshot] = useHeadshot()
  const [failed, setFailed] = useState(() => !hasWebGL())
  const [dragging, setDragging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const limbs = useMemo(() => limbCondition(profile.name), [profile.name])

  const onFail = (err: unknown) => {
    console.warn('[dweller] 3D unavailable, using paper doll', err)
    setFailed(true)
  }

  const pick = (file: File | null | undefined) => {
    if (!file) return
    if (!isImageFile(file)) return setMessage('THAT FILE IS NOT AN IMAGE. TRY A PHOTO.')
    setMessage(null)
    openOverlay('headshot-crop', file)
  }

  const onDragOver = (e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  return (
    <div
      className={`status-panel${dragging ? ' is-dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setDragging(false)}
      onDrop={onDrop}
    >
      <div className="status-stage">
        <div className="status-figure">
          {failed ? (
            <PaperDollFallback />
          ) : (
            <SceneBoundary onError={onFail}>
              <Suspense fallback={<p className="loading status-loading">LOADING<span className="cursor">▌</span></p>}>
                <DwellerScene onFail={onFail} />
              </Suspense>
            </SceneBoundary>
          )}
        </div>
        {LIMBS.map((l) => (
          <div key={l} className={`limb limb--${slug(l)}`}>
            <span className="limb__bar" role="meter" aria-label={`${l} condition`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(limbs[l] * 100)}>
              <span style={{ width: `${limbs[l] * 100}%` }} />
            </span>
            <span className="limb__label">{l}</span>
          </div>
        ))}
      </div>

      <div className="status-id">
        <span className="status-id__name">{profile.name || 'VAULT DWELLER'}</span>
        <span className="status-id__vault">VAULT {profile.vault || '111'}</span>
      </div>

      <ul className="status-actions" aria-label="Status actions">
        <li>
          <button type="button" className="status-action" onClick={() => fileInput.current?.click()}>
            UPLOAD HEADSHOT
          </button>
        </li>
        {headshot && (
          <li>
            <button type="button" className="status-action" onClick={() => setHeadshot(null)}>
              REMOVE HEADSHOT
            </button>
          </li>
        )}
      </ul>
      <p className="pip-note status-note">{message ?? `${PRIVACY_NOTE} Drop a photo here or tap upload.`}</p>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="headshot-input"
        onChange={(e) => {
          pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {dragging && <div className="status-drop" aria-hidden>DROP PHOTO TO SCAN</div>}
    </div>
  )
}
