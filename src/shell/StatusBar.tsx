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
      <div className="status-box status-box--meta">
        <span>{fmtTime(now)}</span>
        <span>CAPS {caps}</span>
      </div>
    </footer>
  )
}
