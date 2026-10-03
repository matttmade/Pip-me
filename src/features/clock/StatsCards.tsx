import { useId, type ReactNode } from 'react'
import { useBattery } from '../device/useBattery'
import { formatLocalHour, formatLocalTime, radsLevel, type Weather } from '../weather/openMeteo'
import { gaugeAngle, pctHeight, scaleY, seriesRange, slotX, sparkPoints } from './chart'
import { listeningMs, questsToday, TAB_COUNT, uptimeMs, xpToday, type SessionLog } from './sessionLog'
import { compassPoint, formatCountdown, formatDuration, GOLDEN_MS, goldenHour, moonPath, moonPhase, nextPhases, nextSunEvent } from './sky'
import type { Diagnostics } from './useDiagnostics'
import { WeatherGlyph } from './WeatherGlyph'

type WeatherStatus = 'idle' | 'loading' | 'ok' | 'error'

/** A framed STATS card: ─ TITLE ───── aside ─ */
export function Card({ title, aside, className = '', children }: { title: string; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`stats-box pip-frame ${className}`} aria-label={title}>
      <h3 className="pip-frame__title">
        <span>{title}</span>
        {aside != null && <span className="pip-frame__aside stats-aside">{aside}</span>}
      </h3>
      {children}
    </section>
  )
}

/** The intentional "no data" state for anything fed by the weather uplink. */
export function SignalLost({ status, what }: { status: WeatherStatus; what: string }) {
  const lost = status === 'error'
  return (
    <div className={`stats-lost${lost ? ' is-lost' : ''}`} role="status">
      <svg viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden className="stats-lost__trace">
        <polyline
          points={lost ? '0,12 30,12 33,5 36,19 39,9 42,14 45,12 120,12' : '0,12 20,12 23,6 26,18 29,12 60,12 63,6 66,18 69,12 100,12 103,6 106,18 109,12 120,12'}
        />
      </svg>
      <b>{lost ? 'SIGNAL LOST' : 'ACQUIRING SIGNAL…'}</b>
      <span>{lost ? `${what} UPLINK OFFLINE. RETRYING EVERY MINUTE.` : `TUNING ${what} UPLINK`}</span>
    </div>
  )
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const dayLabel = (iso: string, i: number) => (i === 0 ? 'TODAY' : DAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()])

/* ---------------- FORECAST ---------------- */
const CW = 240
const CH = 80
const T_TOP = 8
const T_BOT = 44
const B_TOP = 50
const B_BOT = 78

export function ForecastCard({ w, status }: { w: Weather | null; status: WeatherStatus }) {
  const hours = w?.hourly ?? []
  const days = w?.daily ?? []
  const temps = hours.map((h) => h.temp)
  const r = seriesRange(temps)
  const peak = hours.reduce((m, h) => Math.max(m, h.precip), 0)
  return (
    <Card title="FORECAST" aside={hours.length ? `NEXT ${hours.length} HRS` : undefined} className="stats-forecast">
      {!w || !hours.length ? (
        w ? <p className="stats-dim">HOURLY TELEMETRY NOT RECEIVED.</p> : <SignalLost status={status} what="FORECAST" />
      ) : (
        <>
          <div className="fc">
            <div className="fc__row fc__temps" style={{ ['--n' as string]: hours.length }}>
              {hours.map((h) => (
                <span key={h.at} className={r && (h.temp === r.max || h.temp === Math.min(...temps)) ? 'is-key' : ''}>
                  {h.temp}°
                </span>
              ))}
            </div>
            <svg className="fc__plot" viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" role="img" aria-label={`Temperature ${temps.join(', ')}; precipitation chance peaks at ${peak}%`}>
              <line className="fc__base" x1="0" x2={CW} y1={B_BOT + 0.5} y2={B_BOT + 0.5} />
              {hours.map((h, i) => {
                const bw = (CW / hours.length) * 0.56
                const bh = pctHeight(h.precip, B_BOT - B_TOP, 1.5)
                return <rect key={h.at} className="fc__bar" x={slotX(i, hours.length, CW) - bw / 2} y={B_BOT - bh} width={bw} height={bh} />
              })}
              <polyline className="fc__line fc__line--glow" points={sparkPoints(temps, CW, T_TOP, T_BOT)} />
              <polyline className="fc__line" points={sparkPoints(temps, CW, T_TOP, T_BOT)} />
              {r &&
                hours.map((h, i) => (
                  <line key={h.at} className="fc__dot" x1={slotX(i, hours.length, CW)} x2={slotX(i, hours.length, CW)} y1={scaleY(h.temp, r, T_TOP, T_BOT)} y2={scaleY(h.temp, r, T_TOP, T_BOT)} />
                ))}
            </svg>
            <div className="fc__row fc__pcts" style={{ ['--n' as string]: hours.length }}>
              {hours.map((h) => (
                <span key={h.at} className={h.precip >= 50 ? 'is-key' : ''}>
                  {h.precip}%
                </span>
              ))}
            </div>
            <div className="fc__row fc__hours" style={{ ['--n' as string]: hours.length }}>
              {hours.map((h, i) => (
                <span key={h.at}>{i === 0 ? 'NOW' : formatLocalHour(h.at, w.utcOffset)}</span>
              ))}
            </div>
          </div>
          <div className="fc__legend">
            <span>
              <i className="fc__key fc__key--line" /> TEMP °{w.units}
            </span>
            <span>
              <i className="fc__key fc__key--bar" /> PRECIP CHANCE
            </span>
          </div>
          {days.length > 1 && (
            <ol className="fc-days" aria-label="Daily outlook" style={{ ['--n' as string]: days.length }}>
              {days.map((d, i) => (
                <li key={d.date} className={i === 0 ? 'is-today' : ''}>
                  <span className="fc-days__name">{dayLabel(d.date, i)}</span>
                  <WeatherGlyph code={d.code} size={30} />
                  <span className="fc-days__hl">
                    {d.hi}° <span>{d.lo}°</span>
                  </span>
                  <span className="fc-days__p">{d.precip}%</span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Card>
  )
}

/* ---------------- SKY ---------------- */
export function MoonDisc({ fraction, size = 72, south = false, dots = true }: { fraction: number; size?: number; south?: boolean; dots?: boolean }) {
  const id = useId()
  const r = 30
  const d = moonPath(fraction, r)
  return (
    <svg className="moon" viewBox="-36 -36 72 72" width={size} height={size} aria-hidden>
      {dots && (
        <defs>
          <pattern id={id} width="3" height="3" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.05" className="moon__dot" />
          </pattern>
        </defs>
      )}
      <circle r={r} className="moon__dark" />
      {d && (
        <g transform={south ? 'scale(-1 1)' : undefined}>
          <path d={d} className="moon__lit" />
          {dots && <path d={d} fill={`url(#${id})`} />}
        </g>
      )}
      <circle r={r} className="moon__rim" />
    </svg>
  )
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const shortDate = (epoch: number) => {
  const d = new Date(epoch)
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
}

function goldenLabel(now: number, w: Weather, gold: ReturnType<typeof goldenHour>): string {
  if (!gold) return '--'
  if (gold.active) return `NOW · ${gold.active}`
  const start = now < gold.morning.start ? gold.morning.start : now < gold.evening.start ? gold.evening.start : w.sunriseNext
  if (start == null) return '--'
  const t = (e: number) => formatLocalTime(e, w.utcOffset).replace(' ', '')
  return `${t(start)}–${t(start + GOLDEN_MS)}`
}

export function SkyCard({ w, status, now, lat }: { w: Weather | null; status: WeatherStatus; now: number; lat: number }) {
  const moon = moonPhase(now)
  const ev = w ? nextSunEvent(now, w) : null
  const gold = w ? goldenHour(now, w.sunrise, w.sunset) : null
  const marks = nextPhases(now)
  return (
    <Card title="SKY" aside={moon.name} className="stats-sky">
      <div className="sky">
        <MoonDisc fraction={moon.fraction} south={lat < 0} size={84} />
        <div className="sky__moon">
          <b>{Math.round(moon.illumination * 100)}% LIT</b>
          <span>AGE {moon.age.toFixed(1)} DAYS</span>
          <span>{moon.daysToFull === 0 ? 'FULL MOON TONIGHT' : `FULL IN ${moon.daysToFull} DAYS`}</span>
        </div>
      </div>
      <ol className="sky__phases" aria-label="Upcoming moon phases">
        {marks.map((m) => (
          <li key={m.name}>
            <MoonDisc fraction={m.fraction} south={lat < 0} size={22} dots={false} />
            <span>{m.name}</span>
            <b>{shortDate(m.at)}</b>
          </li>
        ))}
      </ol>
      {ev ? (
        <>
          <p className="stats-countdown">
            <span>{ev.kind} IN</span> <b>{formatCountdown(ev.ms)}</b>
          </p>
          <dl className="stats-dl">
            <dt>{ev.kind === 'SUNSET' ? 'SUN DOWN AT' : 'SUN UP AT'}</dt>
            <dd>{formatLocalTime(ev.at, w!.utcOffset)}</dd>
            <dt>GOLDEN HOUR</dt>
            <dd className={gold?.active ? 'stats-blink' : ''}>{goldenLabel(now, w!, gold)}</dd>
          </dl>
        </>
      ) : (
        <p className="stats-dim stats-lostline">{status === 'error' ? 'SOLAR FIX LOST · LUNAR MODEL ONBOARD' : 'ACQUIRING SOLAR FIX…'}</p>
      )}
    </Card>
  )
}

/* ---------------- RADIATION ---------------- */
const UV_MAX = 12
function arc(a0: number, a1: number, r: number) {
  const p = (a: number) => [Math.sin((a * Math.PI) / 180) * r, -Math.cos((a * Math.PI) / 180) * r].map((n) => +n.toFixed(2))
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}`
}

export function RadsCard({ w, status }: { w: Weather | null; status: WeatherStatus }) {
  if (!w) {
    return (
      <Card title="RADIATION" className="stats-rads">
        <SignalLost status={status} what="DOSIMETER" />
      </Card>
    )
  }
  const v = w.uvNow
  const segs = Array.from({ length: UV_MAX }, (_, i) => i)
  return (
    <Card title="RADIATION" aside="UV INDEX" className="stats-rads">
      <div className="gauge">
        <svg viewBox="-50 -48 100 54" className="gauge__svg" role="meter" aria-label="UV index" aria-valuemin={0} aria-valuemax={UV_MAX} aria-valuenow={v}>
          {segs.map((i) => (
            <path key={i} d={arc(gaugeAngle(i, UV_MAX) + 1.6, gaugeAngle(i + 1, UV_MAX) - 1.6, 40)} className={`gauge__seg${i < v ? ' is-on' : ''}${i >= 8 ? ' is-hot' : ''}`} />
          ))}
          {[0, 3, 6, 8, 11].map((t) => (
            <text key={t} x={Math.sin((gaugeAngle(t, UV_MAX) * Math.PI) / 180) * 29} y={-Math.cos((gaugeAngle(t, UV_MAX) * Math.PI) / 180) * 29 + 2.5} className="gauge__tick">
              {t}
            </text>
          ))}
          <g className="gauge__needle" style={{ transform: `rotate(${gaugeAngle(v, UV_MAX)}deg)` }}>
            <line x1="0" y1="2" x2="0" y2="-36" />
          </g>
          <circle r="3.5" className="gauge__hub" />
        </svg>
        <div className="gauge__read">
          <b>{v.toFixed(1)}</b>
          <span>RADS · {radsLevel(v)}</span>
        </div>
      </div>
      <dl className="stats-dl">
        <dt>PEAK TODAY</dt>
        <dd>
          {w.uv.toFixed(1)} {radsLevel(w.uv)}
        </dd>
        <dt>ADVISORY</dt>
        <dd>{w.uv >= 8 ? 'SEEK SHELTER MIDDAY' : w.uv >= 6 ? 'SUNSCREEN · RAD-X' : w.uv >= 3 ? 'SHADE AT NOON' : 'SAFE EXPOSURE'}</dd>
      </dl>
    </Card>
  )
}

/* ---------------- WIND ---------------- */
export function WindCard({ w, status }: { w: Weather | null; status: WeatherStatus }) {
  if (!w) {
    return (
      <Card title="WIND" className="stats-wind">
        <SignalLost status={status} what="ANEMOMETER" />
      </Card>
    )
  }
  const dir = w.windDir
  return (
    <Card title="WIND" aside={dir != null ? `FROM ${compassPoint(dir)}` : undefined} className="stats-wind">
      <div className="compass-wrap">
        <svg viewBox="-40 -40 80 80" className="compass" role="img" aria-label={dir != null ? `Wind from ${compassPoint(dir)}, ${w.wind} ${w.windUnit}` : `Wind ${w.wind} ${w.windUnit}`}>
          <circle r="34" className="compass__ring" />
          {Array.from({ length: 36 }, (_, i) => (
            <line key={i} y1={-34} y2={i % 9 === 0 ? -27 : -31} transform={`rotate(${i * 10})`} className="compass__tick" />
          ))}
          {(['N', 'E', 'S', 'W'] as const).map((p, i) => (
            <text key={p} x={Math.sin((i * Math.PI) / 2) * 20} y={-Math.cos((i * Math.PI) / 2) * 20 + 3} className="compass__pt">
              {p}
            </text>
          ))}
          {dir != null && (
            // The arrow flies downwind: it starts on the side the wind comes from.
            <g className="compass__needle" style={{ transform: `rotate(${dir + 180}deg)` }}>
              <path d="M0 -24L5 -12H1.6V22H-1.6V-12H-5Z" />
            </g>
          )}
        </svg>
        <div className="gauge__read">
          <b>{w.wind}</b>
          <span>{w.windUnit}</span>
        </div>
      </div>
      <dl className="stats-dl">
        <dt>GUSTS</dt>
        <dd>{w.gusts != null ? `${w.gusts} ${w.windUnit}` : '--'}</dd>
        <dt>BEARING</dt>
        <dd>{dir != null ? `${dir}° ${compassPoint(dir)}` : 'CALM / UNKNOWN'}</dd>
      </dl>
    </Card>
  )
}

/* ---------------- SESSION LOG ---------------- */
export function SessionCard({ log, now }: { log: SessionLog; now: number }) {
  const q = questsToday(log, now)
  const xp = xpToday(log, now)
  return (
    <Card
      title="SESSION LOG"
      aside={
        <>
          <i className="stats-live" aria-hidden /> LIVE
        </>
      }
      className="stats-session"
    >
      <p className="stats-uptime">
        <span>UPTIME</span> <b>{formatDuration(uptimeMs(log, now))}</b>
      </p>
      <dl className="stats-dl">
        <dt>TABS VISITED</dt>
        <dd>
          {Math.min(log.tabs.length, TAB_COUNT)}/{TAB_COUNT}
        </dd>
        <dt>SECTION SWITCHES</dt>
        <dd>{log.switches}</dd>
        <dt>GLITCHES WITNESSED</dt>
        <dd>{log.glitches}</dd>
        <dt>QUESTS TODAY</dt>
        <dd>{q ? `${q} (+${xp} XP)` : '0'}</dd>
        <dt>TERMINALS HACKED</dt>
        <dd>{log.hackTries ? `${log.hacks}/${log.hackTries}` : '0'}</dd>
        <dt>STATIONS TUNED</dt>
        <dd>{log.tuned}</dd>
        <dt>RADIO TIME</dt>
        <dd>
          {formatDuration(listeningMs(log, now))}
          {log.radioSince != null && <span className="stats-onair"> ON AIR</span>}
        </dd>
      </dl>
    </Card>
  )
}

/* ---------------- DIAGNOSTICS ---------------- */
export function DiagnosticsCard({ d, reduced }: { d: Diagnostics; reduced: boolean }) {
  const bat = useBattery()
  const pct = Math.round(bat.level * 100)
  const link = [d.effectiveType?.toUpperCase(), d.downlink != null ? `${d.downlink} MBPS` : null, d.rtt != null ? `${d.rtt}MS` : null].filter(Boolean).join(' · ')
  return (
    <Card title="PIP-OS DIAGNOSTICS" className="stats-diag">
      <div className="diag-power">
        <span className="diag-power__label">POWER</span>
        <span className="diag-cell" role="meter" aria-label="Battery" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ ['--pct' as string]: `${pct}%` }}>
          <span className="diag-cell__fill" />
        </span>
        <b>{d.batterySensor ? `${pct}%` : 'MAINS'}</b>
      </div>
      <dl className="stats-dl">
        <dt>CELL</dt>
        <dd>{!d.batterySensor ? 'NO SENSOR · ASSUMED FULL' : bat.charging ? 'CHARGING' : 'DISCHARGING'}</dd>
        <dt>NETWORK</dt>
        <dd className={d.online ? '' : 'stats-blink'}>{d.online ? 'ONLINE' : 'OFFLINE'}</dd>
        {link && (
          <>
            <dt>LINK</dt>
            <dd>{link}</dd>
          </>
        )}
        <dt>DISPLAY</dt>
        <dd>
          {d.width}×{d.height} @{d.dpr}X
        </dd>
        <dt>MOTION</dt>
        <dd>{reduced ? 'REDUCED' : 'FULL'}</dd>
        {d.cores != null && (
          <>
            <dt>CORES{d.memory != null ? ' / MEM' : ''}</dt>
            <dd>
              {d.cores}
              {d.memory != null ? ` / ${d.memory} GB` : ''}
            </dd>
          </>
        )}
        <dt>ZONE</dt>
        <dd className="stats-ellipsis">{d.timeZone.toUpperCase()}</dd>
      </dl>
    </Card>
  )
}
