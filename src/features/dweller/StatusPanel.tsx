import { Component, lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useProfile, useStored } from '../../lib/contracts'
import { startPerkTracking } from '../perks/perks'
import { DEFAULT_DETAIL, DETAIL_KEY, normalizeDetail, type DetailLevel } from './fidelity'
import { LIMBS, limbCondition, type Limb } from './limbs'
import PaperDollFallback from './PaperDollFallback'
import { DEFAULT_FIGURE, FIGURE_KEY, normalizeFigure, type Figure } from './vaultboy/behavior'
import { hasWebGL } from './webgl'

// three.js only loads with the scene, in its own chunk.
const DwellerScene = lazy(() => import('./DwellerScene'))
const VaultBoyScene = lazy(() => import('./VaultBoyScene'))

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

/**
 * STAT > STATUS: the figure, limb condition bars around it, and the dweller name plate.
 * Figure and detail options live in DATA > SYSTEM > FIGURE.
 */
export default function StatusPanel() {
  useEffect(startPerkTracking, [])
  const [profile] = useProfile()
  const [storedDetail] = useStored<DetailLevel>(DETAIL_KEY, DEFAULT_DETAIL)
  const detail = normalizeDetail(storedDetail)
  const [storedFigure] = useStored<Figure>(FIGURE_KEY, DEFAULT_FIGURE)
  const figure = normalizeFigure(storedFigure)
  const [failed, setFailed] = useState(() => !hasWebGL())
  // Vault Boy failed (GLB or WebGL trouble): show the procedural Dweller instead.
  const [vbFailed, setVbFailed] = useState(false)
  const showVaultBoy = figure === 'VAULTBOY' && !vbFailed
  const limbs = useMemo(() => limbCondition(profile.name), [profile.name])

  const onFail = (err: unknown) => {
    console.warn('[dweller] 3D unavailable, using paper doll', err)
    setFailed(true)
  }
  const onVbFail = (err: unknown) => {
    console.warn('[dweller] Vault Boy unavailable, using the Dweller', err)
    setVbFailed(true)
  }

  return (
    <div className="status-panel">
      <div className="status-stage">
        <div className="status-figure">
          {failed ? (
            <PaperDollFallback />
          ) : (
            <SceneBoundary key={showVaultBoy ? 'vb' : 'dweller'} onError={showVaultBoy ? onVbFail : onFail}>
              <Suspense fallback={<p className="loading status-loading">LOADING<span className="cursor">▌</span></p>}>
                {showVaultBoy ? <VaultBoyScene onFail={onVbFail} /> : <DwellerScene onFail={onFail} detail={detail} />}
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
    </div>
  )
}
