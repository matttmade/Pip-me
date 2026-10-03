import { useViewCtx } from '../device/viewContext'
import { useClock } from '../features/clock/useClock'
import { useDaylight } from '../features/clock/useDaylight'
import { useBattery } from '../features/device/useBattery'
import { useXp } from '../features/quests/useXp'

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function StatusBar() {
  const battery = useBattery()
  const xp = useXp()
  const day = useDaylight()
  const now = useClock()
  const { view, canArm, setView } = useViewCtx()
  const hp = Math.round(battery.level * 100)
  const ap = day.total > 0 ? Math.round((day.remaining / day.total) * 100) : 100
  const glyph = (d: string) => (
    <svg className="status-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d={d} />
    </svg>
  )
  return (
    <footer className="status-bar" aria-label="Status">
      <div className="status-box status-box--hp" title={battery.charging ? 'HP: battery (charging)' : 'HP: battery'} aria-label={`HP ${hp} of 100`}>
        <span className="status-label">
          HP <b>{hp}<span className="status-word">/100</span></b>
        </span>
      </div>
      <div className="status-box status-box--level" title={`${xp.xp} XP`}>
        <span className="status-label">
          <span className="status-word">LEVEL</span>
          <span className="status-short">LVL</span> <b>{xp.level}</b>
        </span>
        <span className="xp-bar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xp.progress * 100)}>
          <span style={{ width: `${xp.progress * 100}%` }} />
        </span>
      </div>
      <div className="status-box status-box--ap" title="AP: daylight remaining" aria-label={`AP ${ap} of 100 (daylight remaining)`}>
        <span className="status-label">
          AP <b>{ap}<span className="status-word">/100</span></b>
        </span>
      </div>
      {canArm && (
        <button
          className="status-box status-box--view"
          onClick={() => setView(view === 'arm' ? 'screen' : 'arm')}
          aria-label={view === 'arm' ? 'Back to screen view' : 'Exit to on-arm view (more controls)'}
          title={view === 'arm' ? 'Screen view (V)' : 'On-arm view (V)'}
        >
          {glyph(view === 'arm' ? 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5' : 'M10 4H4v16h6 M14 12h7 M17 8l4 4-4 4')}
          <span className="status-label status-word">{view === 'arm' ? 'SCREEN' : 'EXIT'}</span>
        </button>
      )}
      <div className="status-box status-box--meta">
        <span>
          {fmtTime(now).replace(/\s?[AP]M$/i, '')}
          <span className="status-word">{fmtTime(now).match(/\s?[AP]M$/i)?.[0] ?? ''}</span>
        </span>
      </div>
    </footer>
  )
}
