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
  const glyph = (d: string) => (
    <svg className="status-icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d={d} />
    </svg>
  )
  return (
    <footer className="status-bar" aria-label="Status">
      <div className="status-box status-box--level" title={`${xp.xp} XP`}>
        {glyph('M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z')}
        <span className="status-label">
          <span className="status-word">LVL </span>
          <b>{xp.level}</b>
        </span>
        <span className="xp-bar" role="progressbar" aria-label="XP to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(xp.progress * 100)}>
          <span style={{ width: `${xp.progress * 100}%` }} />
        </span>
      </div>
      <div className="status-box" title={battery.charging ? 'Battery (charging)' : 'Battery'} aria-label={`HP ${hp} of 100`}>
        {glyph('M9 3h6v6h6v6h-6v6H9v-6H3V9h6z')}
        <span className="status-label">
          <span className="status-word">HP </span>
          <b>{hp}</b>
          <span className="status-word">/100</span>
        </span>
      </div>
      <div className="status-box" title="Daylight remaining">
        <span className="status-label">AP</span>
        <span className="xp-bar" role="progressbar" aria-label="AP (daylight remaining)" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ap}>
          <span style={{ width: `${ap}%` }} />
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
        <span className="status-sep" aria-hidden />
        <span className="status-label" title="Caps (daily hack streak)">
          {glyph('M12 2l2 2.3 3-.6.6 3 2.7 1.4-1.2 2.9 1.2 2.9-2.7 1.4-.6 3-3-.6L12 22l-2-2.3-3 .6-.6-3-2.7-1.4L4.9 12 3.7 9.1l2.7-1.4.6-3 3 .6z')}
          <span className="status-word"> CAPS</span> <b>{caps}</b>
        </span>
      </div>
    </footer>
  )
}
