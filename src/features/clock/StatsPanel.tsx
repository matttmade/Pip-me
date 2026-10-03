import { useEffect, useRef } from 'react'
import { usePrefersReducedMotion } from '../../lib/hooks'
import { useSettings } from '../../lib/profile'
import { formatCoords } from '../map/geo'
import { useLocation } from '../map/useLocation'
import { usePlaceName } from '../map/usePlaceName'
import { formatLocalTime } from '../weather/openMeteo'
import { useWeather } from '../weather/useWeather'
import { startSessionTracking, useSessionLog } from './sessionTracker'
import { Card, DiagnosticsCard, ForecastCard, RadsCard, SessionCard, SignalLost, SkyCard, WindCard } from './StatsCards'
import { clockParts, daylight, formatDate, formatMinutes, wastelandDate, weekday } from './time'
import { useClock } from './useClock'
import { useDiagnostics } from './useDiagnostics'
import { WeatherGlyph } from './WeatherGlyph'

const SCROLL_STEP = 80

/** DATA > STATS: clock, dates, conditions, forecast, sky, rads, wind, session log and diagnostics. */
export default function StatsPanel() {
  const [settings] = useSettings()
  const now = useClock(1000)
  const loc = useLocation({ auto: true })
  const place = usePlaceName(loc)
  const { lat, lon } = loc.coords
  const { weather: w, status } = useWeather(lat, lon)
  const log = useSessionLog()
  const diag = useDiagnostics()
  const reduced = usePrefersReducedMotion()
  const t = clockParts(now)
  const ms = now.getTime()
  const day = daylight(ms, w?.sunrise, w?.sunset)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(startSessionTracking, [])

  // ↑/↓ scroll the card grid (←/→ stay with the global section navigation).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const el = scroller.current
      const target = e.target as HTMLElement | null
      if (!el || target?.closest('input, textarea, select, [data-own-arrows], [role="slider"]')) return
      e.preventDefault()
      el.scrollBy({ top: e.key === 'ArrowDown' ? SCROLL_STEP : -SCROLL_STEP, behavior: reduced ? 'auto' : 'smooth' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [reduced])

  return (
    <div className="stats-panel" ref={scroller} tabIndex={-1}>
      <div className="stats-grid">
        <section className="stats-box stats-clock" aria-label="Clock">
          <div className="stats-time">
            <span className="stats-time__hm pip-halftone">{t.hm}</span>
            <span className="stats-time__side">
              <span>{t.ampm}</span>
              <span className="stats-time__sec">{t.seconds}</span>
            </span>
          </div>
          <div className="stats-date">
            {weekday(now)} · {formatDate(now)}
          </div>
          {settings.wastelandDate && (
            <div className="stats-wl">
              <span>WASTELAND DATE</span>
              <b>{wastelandDate(now)}</b>
            </div>
          )}
        </section>

        <Card title="CONDITIONS" aside={w ? (w.isDay ? 'DAYTIME' : 'NIGHTTIME') : undefined} className="stats-cond">
          {w ? (
            <>
              <div className="cond">
                <WeatherGlyph code={w.code} night={!w.isDay} size={52} />
                <p className="stats-big">
                  {w.temp}°<span className="stats-dim">{w.units}</span>
                </p>
              </div>
              <p className="cond__label">{w.label}</p>
              <dl className="stats-dl">
                <dt>FEELS LIKE</dt>
                <dd>{w.feels}°</dd>
                <dt>HIGH / LOW</dt>
                <dd>
                  {w.hi}° / {w.lo}°
                </dd>
                {w.humidity != null && (
                  <>
                    <dt>HUMIDITY</dt>
                    <dd>{w.humidity}%</dd>
                  </>
                )}
                <dt>LAST SYNC</dt>
                <dd>{formatLocalTime(w.fetchedAt, w.utcOffset)}</dd>
              </dl>
            </>
          ) : (
            <SignalLost status={status} what="ATMOSPHERIC" />
          )}
        </Card>

        <ForecastCard w={w} status={status} />
        <SkyCard w={w} status={status} now={ms} lat={lat} />

        <Card title="DAY CYCLE" className="stats-day">
          {w?.sunrise != null && w.sunset != null ? (
            <>
              <div
                className={`daybar${day.isDay ? '' : ' is-night'}`}
                role="meter"
                aria-label="Daylight progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(day.progress * 100)}
                style={{ ['--pct' as string]: `${day.progress * 100}%`, ['--p' as string]: day.progress }}
              >
                <span className="daybar__fill" />
                <span className="daybar__sun" aria-hidden />
              </div>
              <div className="daybar__ends">
                <span>SUNRISE {formatLocalTime(w.sunrise, w.utcOffset)}</span>
                <span>SUNSET {formatLocalTime(w.sunset, w.utcOffset)}</span>
              </div>
              <dl className="stats-dl">
                <dt>DAYLIGHT LEFT</dt>
                <dd>{day.isDay || day.remaining ? formatMinutes(day.remaining) : 'NIGHTFALL'}</dd>
                <dt>DAY LENGTH</dt>
                <dd>{formatMinutes(day.total)}</dd>
              </dl>
            </>
          ) : (
            <SignalLost status={status} what="SOLAR" />
          )}
        </Card>

        <RadsCard w={w} status={status} />
        <WindCard w={w} status={status} />

        <Card title="LOCATION" className="stats-loc">
          <p className="stats-big stats-place">[ {place} ]</p>
          <dl className="stats-dl">
            <dt>COORDINATES</dt>
            <dd>{formatCoords(lat, lon)}</dd>
            <dt>SOURCE</dt>
            <dd>{loc.source === 'gps' ? 'GPS' : loc.source === 'search' ? 'MANUAL' : 'DEFAULT SECTOR'}</dd>
            {loc.accuracy != null && loc.source === 'gps' && (
              <>
                <dt>ACCURACY</dt>
                <dd>{settings.units === 'F' ? `±${Math.round(loc.accuracy * 3.281)} FT` : `±${Math.round(loc.accuracy)} M`}</dd>
              </>
            )}
          </dl>
        </Card>

        <SessionCard log={log} now={ms} />
        <DiagnosticsCard d={diag} reduced={reduced} />
      </div>
    </div>
  )
}
