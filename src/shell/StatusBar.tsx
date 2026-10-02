import { useViewCtx } from '../device/viewContext'
import { useClock } from '../features/clock/useClock'
import { useDaylight } from '../features/clock/useDaylight'
import { useBattery } from '../features/device/useBattery'
import { useXp } from '../features/quests/useXp'
import { useCaps } from '../features/terminal/useCaps'

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

export function StatusBar() {
  const battery = useBattery()
  const xp = useXp()
  const day = useDaylight()
  const caps = useCaps()
  const now = useClock()
  const { view, canArm, setView } = useViewCtx()
  const hp = Math.round(battery.level * 100)
  const ap = day.total > 0 ? Math.round((day.remaining / day.total) * 100) : 100
  return (
    <footer className="status-bar" aria-label="Status">
      <div className="status-box" title={battery.charging ? 'Charging' : 'Battery'}>
        HP {hp}/100
      </div>
      <div className="status-box status-box--level">
        <span>LEVEL {xp.level}</span>
        <span className="xp-bar" role="progressbar" aria-label="XP" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xp.progress * 100)}>
          <span style={{ width: `${xp.progress * 100}%` }} />
        </span>
      </div>
      <div className="status-box" title="Daylight remaining">
        AP {ap}/100
      </div>
      {canArm && (
        <button
          className="status-box status-box--view"
          onClick={() => setView(view === 'arm' ? 'screen' : 'arm')}
          aria-label={view === 'arm' ? 'Screen view' : 'On arm view (more controls)'}
          title={view === 'arm' ? 'Screen view (V)' : 'On arm view (V)'}
        >
          <svg viewBox="0 0 24 24" aria-hidden focusable="false">
            {view === 'arm' ? (
              <path d="M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5" />
            ) : (
              <path d="M9 4h5 M14 20H9 M6 7h11v10H6z M17 10h2v4h-2" />
            )}
          </svg>
        </button>
      )}
      <div className="status-box status-box--meta">
        <span>{fmtTime(now)}</span>
        <span>CAPS {caps}</span>
      </div>
    </footer>
  )
}
