import { PipSlider } from '../../shell/PipSlider'
import { SeekBar } from './SeekBar'
import type { ScStatus } from './SoundCloudPlayer'
import { SKIP_MS } from './transport'

type Props = {
  /** The widget is mounted (station tuned). */
  tuned: boolean
  status: ScStatus
  position: number
  duration: number
  volume: number
  muted: boolean
  onPlayPause: () => void
  onSkip: (deltaMs: number) => void
  onSeek: (ms: number) => void
  onVolume: (v: number) => void
  onMute: () => void
  onJoinLive: () => void
  onFromStart: () => void
}

const Icon = ({ kind }: { kind: 'play' | 'pause' | 'wait' | 'back' | 'fwd' }) => (
  <svg className="radio-tx__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    {kind === 'play' && <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" />}
    {kind === 'pause' && <path d="M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z" fill="currentColor" />}
    {kind === 'wait' && <path d="M2 7h3v2H2zM6.5 7h3v2h-3zM11 7h3v2h-3z" fill="currentColor" />}
    {kind === 'back' && <path d="M8 3.5v9L1.5 8zM15 3.5v9L8.5 8z" fill="currentColor" />}
    {kind === 'fwd' && <path d="M1 3.5v9L7.5 8zM8 3.5v9L14.5 8z" fill="currentColor" />}
  </svg>
)

const pct = (v: number) => `${Math.round(v * 100)}%`

/** Compact Pip-Boy deck for the streamed station: play/pause, ±30s, seek, volume, mute, live/start. */
export function ScTransport(p: Props) {
  const playing = p.tuned && p.status === 'playing'
  const loading = p.tuned && p.status === 'loading'
  const ready = p.tuned && (p.status === 'playing' || p.status === 'ready')
  // Before tuning in, seeking just moves the resume point (if the length is known).
  const canSeek = (ready || !p.tuned) && p.duration > 0
  const label = playing ? 'PAUSE' : loading ? 'TUNING' : 'PLAY'

  return (
    <div className="radio-tx" data-no-swipe>
      <SeekBar position={p.position} duration={p.duration} onSeek={p.onSeek} disabled={!canSeek} />
      <div className="radio-tx__main">
        <button
          className={`pip-btn radio-tx__play${playing ? ' is-active' : ''}`}
          onClick={p.onPlayPause}
          aria-label={playing ? 'Pause' : 'Play'}
          aria-busy={loading || undefined}
        >
          <Icon kind={playing ? 'pause' : loading ? 'wait' : 'play'} />
          <span>{label}</span>
        </button>
        <button className="pip-btn radio-tx__skip" onClick={() => p.onSkip(-SKIP_MS)} disabled={!canSeek} aria-label="Back 30 seconds">
          <Icon kind="back" />
          <span>30</span>
        </button>
        <button className="pip-btn radio-tx__skip" onClick={() => p.onSkip(SKIP_MS)} disabled={!canSeek} aria-label="Forward 30 seconds">
          <span>30</span>
          <Icon kind="fwd" />
        </button>
        <div className="radio-tx__opts">
          <button className={`pip-btn radio-tx__small${p.muted ? ' is-active' : ''}`} aria-pressed={p.muted} onClick={p.onMute}>
            MUTE
          </button>
          <button className="pip-btn radio-tx__small" onClick={p.onJoinLive} disabled={!canSeek} title="Jump to where the broadcast is right now">
            JOIN LIVE
          </button>
          <button className="pip-btn radio-tx__small" onClick={p.onFromStart} disabled={!canSeek}>
            FROM START
          </button>
        </div>
      </div>
      <PipSlider label="VOLUME" value={p.volume} min={0} max={1} step={0.05} onChange={p.onVolume} format={(v) => (p.muted ? 'MUTED' : pct(v))} />
    </div>
  )
}
