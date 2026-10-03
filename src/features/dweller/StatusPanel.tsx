import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePageVisible, useProfile, useStored } from '../../lib/contracts'
import { useXp } from '../quests/useXp'
import { startPerkTracking } from '../perks/perks'
import { DEFAULT_DETAIL, DETAIL_KEY, normalizeDetail, type DetailLevel } from './fidelity'
import { LIMBS, limbCondition, type Limb } from './limbs'
import { EffectsList, EmoteBar, ReadoutStrip } from './StatusExtras'
import { DEFAULT_FIGURE, FIGURE_KEY, normalizeFigure, type Figure } from './vaultboy/behavior'
import { hasWebGL } from './webgl'
import { WeaponSlot } from './WeaponSlot'
import { useBootDone } from '../../loader/handoff'

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
 * STAT > STATUS: the figure with limb condition bars around it, floating emote buttons,
 * active EFFECTS, four readout boxes (TEMP, RADS, CAPS, QUESTS), the WEAPON slot and the
 * name plate with LEVEL + XP. Figure and detail options live in DATA > SYSTEM > FIGURE.
 * The panel is a size container; dweller.css picks wide / short / compact layouts from it.
 */
export default function StatusPanel() {
  useEffect(startPerkTracking, [])
  // don't start the 3D scene until the boot loader has finished animating
  const bootDone = useBootDone()
  const [profile] = useProfile()
  const [storedDetail] = useStored<DetailLevel>(DETAIL_KEY, DEFAULT_DETAIL)
  const detail = normalizeDetail(storedDetail)
  const [storedFigure] = useStored<Figure>(FIGURE_KEY, DEFAULT_FIGURE)
  const figure = normalizeFigure(storedFigure)
  const visible = usePageVisible()
  // 3D trouble is usually transient on phones (Safari drops WebGL when backgrounded or low on
  // memory), so remount the scene instead of giving up. After repeated failures show an
  // OFFLINE notice with a retry, never a substitute figure.
  const [attempt, setAttempt] = useState(0)
  const [fails, setFails] = useState(0)
  const [lastError, setLastError] = useState<string | null>(() => (hasWebGL() ? null : 'WEBGL UNAVAILABLE'))
  const offline = lastError !== null && (fails >= 3 || lastError === 'WEBGL UNAVAILABLE')
  const limbs = useMemo(() => limbCondition(profile.name), [profile.name])
  const xp = useXp()

  const onFail = useCallback((err: unknown) => {
    console.warn('[dweller] 3D figure failed, retrying', err)
    setLastError(String((err as Error)?.message ?? err).slice(0, 80).toUpperCase())
    setFails((n) => n + 1)
  }, [])
  // retry: right away while visible (short delay), or as soon as the page is visible again
  useEffect(() => {
    if (!lastError || offline || !visible) return
    const t = window.setTimeout(() => setAttempt((a) => a + 1), 700)
    return () => window.clearTimeout(t)
  }, [lastError, fails, offline, visible])
  // a successful scene clears the error streak after a while
  useEffect(() => {
    if (!fails || lastError) return
    const t = window.setTimeout(() => setFails(0), 20_000)
    return () => window.clearTimeout(t)
  }, [fails, lastError])
  const retry = () => {
    setFails(0)
    setLastError(hasWebGL() ? null : 'WEBGL UNAVAILABLE')
    setAttempt((a) => a + 1)
  }
  const sceneKey = `${figure}-${attempt}`
  const showVaultBoy = figure === 'VAULTBOY'
  const failed = offline

  return (
    <div className="status-panel">
      <div className={`status-grid${failed ? '' : ' has-emotes'}`}>
        <div className="status-stage">
          <div className="status-figure">
            {offline ? (
              <button type="button" className="figure-offline" onClick={retry}>
                <span className="figure-offline__title">FIGURE OFFLINE</span>
                <span>TAP TO RETRY</span>
                <small>{lastError}</small>
              </button>
            ) : (
              <SceneBoundary key={sceneKey} onError={onFail}>
                <Suspense
                  fallback={
                    <p className="loading status-loading">
                      LOADING<span className="cursor">▌</span>
                    </p>
                  }
                >
                  {!bootDone ? (
                    <p className="loading status-loading">
                      LOADING<span className="cursor">▌</span>
                    </p>
                  ) : showVaultBoy ? (
                    <VaultBoyScene onFail={onFail} onReady={() => setLastError(null)} />
                  ) : (
                    <DwellerScene onFail={onFail} onReady={() => setLastError(null)} detail={detail} />
                  )}
                </Suspense>
              </SceneBoundary>
            )}
          </div>
          {LIMBS.map((l) => (
            <div key={l} className={`limb limb--${slug(l)}`}>
              <span
                className="limb__bar"
                role="meter"
                aria-label={`${l} condition`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(limbs[l] * 100)}
              >
                <span style={{ width: `${limbs[l] * 100}%` }} />
              </span>
              <span className="limb__label">{l}</span>
            </div>
          ))}
        </div>

        {!failed && <EmoteBar />}
        <EffectsList />
        <ReadoutStrip />
        <WeaponSlot />

        <div className="status-id">
          <span className="status-id__name">{profile.name || 'VAULT DWELLER'}</span>
          <span className="status-id__vault">VAULT {profile.vault || '111'}</span>
          <span className="status-id__level" title={`${xp.xp} XP`}>
            <span>LVL {xp.level}</span>
            <span
              className="xp-bar"
              role="progressbar"
              aria-label="XP to next level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(xp.progress * 100)}
            >
              <span style={{ width: `${xp.progress * 100}%` }} />
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
