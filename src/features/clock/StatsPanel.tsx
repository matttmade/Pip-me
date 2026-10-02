import { useSettings } from '../../lib/profile'
import { formatCoords } from '../map/geo'
import { useLocation } from '../map/useLocation'
import { usePlaceName } from '../map/usePlaceName'
import { formatLocalTime, radsLevel } from '../weather/openMeteo'
import { useWeather } from '../weather/useWeather'
import { clockParts, daylight, formatDate, formatMinutes, wastelandDate, weekday } from './time'
import { useClock } from './useClock'

/** DATA > STATS: clock, dates, local conditions and the day cycle. */
export default function StatsPanel() {
  const [settings] = useSettings()
  const now = useClock(1000)
  const loc = useLocation({ auto: true })
  const place = usePlaceName(loc)
  const { lat, lon } = loc.coords
  const { weather: w, status } = useWeather(lat, lon)
  const t = clockParts(now)
  const day = daylight(now.getTime(), w?.sunrise, w?.sunset)

  return (
    <div className="stats-panel">
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

      <section className="stats-box pip-frame" aria-label="Location">
        <h3 className="pip-frame__title">LOCATION</h3>
        <p className="stats-big">[ {place} ]</p>
        <dl className="stats-dl">
          <dt>COORDINATES</dt>
          <dd>{formatCoords(lat, lon)}</dd>
          <dt>SOURCE</dt>
          <dd>{loc.source === 'gps' ? 'GPS' : loc.source === 'search' ? 'MANUAL' : 'DEFAULT SECTOR'}</dd>
        </dl>
      </section>

      <section className="stats-box pip-frame" aria-label="Conditions">
        <h3 className="pip-frame__title">CONDITIONS</h3>
        {w ? (
          <>
            <p className="stats-big">
              {w.temp}°{w.units} <span className="stats-dim">{w.label}</span>
            </p>
            <dl className="stats-dl">
              <dt>FEELS LIKE</dt>
              <dd>
                {w.feels}°{w.units}
              </dd>
              <dt>HIGH / LOW</dt>
              <dd>
                {w.hi}° / {w.lo}°
              </dd>
              <dt>WIND</dt>
              <dd>
                {w.wind} {w.windUnit}
              </dd>
              <dt>RADS</dt>
              <dd>
                {w.uv.toFixed(1)} {radsLevel(w.uv)}
              </dd>
            </dl>
          </>
        ) : (
          <p className="stats-dim">{status === 'error' ? 'ATMOSPHERIC SENSOR OFFLINE. RETRYING.' : 'SCANNING ATMOSPHERE…'}</p>
        )}
      </section>

      <section className="stats-box stats-day pip-frame" aria-label="Day cycle">
        <h3 className="pip-frame__title">DAY CYCLE</h3>
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
          <p className="stats-dim">SOLAR TRACKING UNAVAILABLE.</p>
        )}
      </section>
    </div>
  )
}
