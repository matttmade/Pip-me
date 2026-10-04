import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { usePageVisible } from '../../lib/hooks'
import { useStored } from '../../lib/store'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { PipSlider } from '../../shell/PipSlider'
import { colHead } from '../holotapes/colHead'
import { Cols, InvDetail } from '../holotapes/ui'
import { evaluate } from './calc'
import { CATEGORIES, categoryOf, convert, fmtNum } from './convert'
import {
  countdown,
  elapsedOf,
  fmtCountdown,
  fmtStopwatch,
  lapDurations,
  lapStopwatch,
  MIN,
  newStopwatch,
  parseDuration,
  pauseCountdown,
  pauseStopwatch,
  progressOf,
  remainingOf,
  resetCountdown,
  setFocusLength,
  startCountdown,
  startStopwatch,
  statusOf,
  switchFocusPhase,
  type Countdown,
} from './timer'
import { TOOLS, type ToolId } from './tools'
import { NO_TIMERS, startTimers, TIMERS_KEY, writeTimers, type Timers } from './timerStore'

startTimers()

/** Re-render on a clock while something is running (paused when the page is hidden). */
function useNow(active: boolean, ms: number) {
  const [now, setNow] = useState(() => Date.now())
  const visible = usePageVisible()
  useEffect(() => {
    if (!active || !visible) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, ms)
    return () => (clearTimeout(first), clearInterval(id))
  }, [active, visible, ms])
  return now
}

const statusTag = (c: Countdown, now: number) => {
  const s = statusOf(c, now)
  return s === 'running' ? fmtCountdown(remainingOf(c, now)) : s === 'paused' ? 'PAUSED' : undefined
}

export default function ToolsPanel() {
  const [timers] = useStored<Timers>(TIMERS_KEY, NO_TIMERS)
  const [selected, setSelected] = useStored<ToolId>('tools:selected', 'focus')
  const sw = timers.stopwatch
  const anyRunning = timers.focus.timer.startedAt != null || timers.countdown.startedAt != null || sw.startedAt != null
  const now = useNow(anyRunning, selected === 'stopwatch' && sw.startedAt != null ? 50 : 250)

  const tags: Partial<Record<ToolId, string>> = {
    focus: statusTag(timers.focus.timer, now),
    countdown: statusTag(timers.countdown, now),
    stopwatch: sw.startedAt != null ? fmtStopwatch(elapsedOf(sw, now)).slice(0, -3) : undefined,
  }
  const items: ListItem[] = [
    colHead('TOOL'),
    ...TOOLS.map((t) => ({
      id: t.id,
      label: t.name,
      right: <Cols wgVal={t.wgVal} extra={tags[t.id] && <span className="tool-tag">{tags[t.id]}</span>} />,
    })),
  ]

  const toggle = (id: ToolId) => {
    const at = Date.now()
    writeTimers((t) => {
      if (id === 'focus') {
        const f = t.focus
        return { ...t, focus: { ...f, timer: f.timer.startedAt != null ? pauseCountdown(f.timer, at) : startCountdown(f.timer, at) } }
      }
      if (id === 'countdown') return { ...t, countdown: t.countdown.startedAt != null ? pauseCountdown(t.countdown, at) : startCountdown(t.countdown, at) }
      return { ...t, stopwatch: t.stopwatch.startedAt != null ? pauseStopwatch(t.stopwatch, at) : startStopwatch(t.stopwatch, at) }
    })
  }

  const activate = (id: string) => {
    if (id === 'focus' || id === 'countdown' || id === 'stopwatch') toggle(id)
    else document.getElementById(`tool-input-${id}`)?.focus()
  }

  const tool = TOOLS.find((t) => t.id === selected) ?? TOOLS[0]
  const running = Object.values(tags).filter(Boolean).length
  let detail
  switch (tool.id) {
    case 'focus':
      detail = <FocusDetail timers={timers} now={now} onToggle={() => toggle('focus')} />
      break
    case 'countdown':
      detail = <CountdownDetail timers={timers} now={now} onToggle={() => toggle('countdown')} />
      break
    case 'stopwatch':
      detail = <StopwatchDetail timers={timers} now={now} onToggle={() => toggle('stopwatch')} />
      break
    case 'convert':
      detail = <ConvertDetail />
      break
    case 'calc':
      detail = <CalcDetail />
  }

  return (
    <div className="inv-panel">
      <p className="inv-status" role="status">
        {TOOLS.length} TOOLS // {running ? `${running} RUNNING` : 'ALL IDLE'} // TIMERS RING ON ANY TAB
      </p>
      <div className="inv-body">
        <ListDetail label="Tools" items={items} selected={tool.id} onSelect={(id) => setSelected(id as ToolId)} onActivate={activate} detail={detail} />
      </div>
    </div>
  )
}

const meta = (id: ToolId) => TOOLS.find((t) => t.id === id)!

function Readout({ text, progress, state }: { text: string; progress?: number; state: string }) {
  return (
    <div className={`tool-readout is-${state}`}>
      <p className="tool-readout__time" aria-live="off">
        {text}
      </p>
      {progress != null && (
        <span className="inv-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${progress * 100}%` }} />
        </span>
      )}
    </div>
  )
}

function RunButtons({ c, now, onToggle, onReset }: { c: Countdown; now: number; onToggle: () => void; onReset: () => void }) {
  const s = statusOf(c, now)
  return (
    <>
      <button className={`pip-btn${s === 'running' ? '' : ' is-active'}`} onClick={onToggle}>
        {s === 'running' ? '[ PAUSE ]' : s === 'paused' ? '[ RESUME ]' : '[ START ]'}
      </button>
      <button className="pip-btn" onClick={onReset} disabled={s === 'idle'}>
        [ RESET ]
      </button>
    </>
  )
}

function FocusDetail({ timers, now, onToggle }: { timers: Timers; now: number; onToggle: () => void }) {
  const f = timers.focus
  const m = meta('focus')
  const s = statusOf(f.timer, now)
  const setLen = (which: 'focus' | 'break', v: number) => writeTimers((t) => ({ ...t, focus: setFocusLength(t.focus, which, v, Date.now()) }))
  return (
    <InvDetail title={m.name} sub={f.phase === 'focus' ? 'PHASE: FOCUS // STAY ON TASK' : 'PHASE: BREAK // STAND UP, STRETCH'} icon={m.icon} wgVal={m.wgVal} stats={[['DOSES', f.sessions]]}>
      <Readout text={fmtCountdown(remainingOf(f.timer, now))} progress={progressOf(f.timer, now)} state={s} />
      <div className="pip-choices">
        <RunButtons c={f.timer} now={now} onToggle={onToggle} onReset={() => writeTimers((t) => ({ ...t, focus: { ...t.focus, timer: resetCountdown(t.focus.timer) } }))} />
        <button className="pip-btn" onClick={() => writeTimers((t) => ({ ...t, focus: switchFocusPhase(t.focus) }))}>
          {f.phase === 'focus' ? '[ SKIP TO BREAK ]' : '[ SKIP BREAK ]'}
        </button>
      </div>
      <PipSlider label="FOCUS" value={f.focusMin} min={5} max={90} step={5} onChange={(v) => setLen('focus', v)} format={(v) => `${v} MIN`} />
      <PipSlider label="BREAK" value={f.breakMin} min={1} max={30} step={1} onChange={(v) => setLen('break', v)} format={(v) => `${v} MIN`} />
      <p className="inv-copy">One dose is a single stretch of focused work. When it wears off the Pip-Boy sounds an alert and loads your break.</p>
    </InvDetail>
  )
}

const PRESETS: [string, number][] = [
  ['1M', MIN],
  ['5M', 5 * MIN],
  ['10M', 10 * MIN],
  ['25M', 25 * MIN],
  ['1H', 60 * MIN],
]

function CountdownDetail({ timers, now, onToggle }: { timers: Timers; now: number; onToggle: () => void }) {
  const c = timers.countdown
  const m = meta('countdown')
  const s = statusOf(c, now)
  const [text, setText] = useState('')
  const [error, setError] = useState(false)
  const set = (ms: number, start: boolean) => writeTimers((t) => ({ ...t, countdown: start ? startCountdown(countdown(ms), Date.now()) : countdown(ms) }))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ms = parseDuration(text)
    if (ms == null) return setError(true)
    set(ms, true)
    setText('')
  }
  return (
    <InvDetail title={m.name} sub={s === 'done' ? 'COMPLETE' : `SET FOR ${fmtCountdown(c.duration)}`} icon={m.icon} wgVal={m.wgVal} stats={[['STATE', s.toUpperCase()]]}>
      <Readout text={fmtCountdown(remainingOf(c, now))} progress={progressOf(c, now)} state={s} />
      <div className="pip-choices">
        <RunButtons c={c} now={now} onToggle={onToggle} onReset={() => writeTimers((t) => ({ ...t, countdown: resetCountdown(t.countdown) }))} />
      </div>
      <form className="tool-row" onSubmit={submit} noValidate>
        <label className="inv-search">
          <span aria-hidden>&gt;</span>
          <input
            id="tool-input-countdown"
            value={text}
            placeholder="SET: 3 / 1:30 / 5M / 1H"
            aria-label="Set countdown"
            aria-invalid={error}
            autoComplete="off"
            onChange={(e) => (setText(e.target.value), setError(false))}
            onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          />
        </label>
        <button className="pip-btn" type="submit">
          [ SET + GO ]
        </button>
      </form>
      {error && <p className="inv-error">TRY 3 (SECONDS), 1:30, 5M OR 1H.</p>}
      <div className="pip-choices tool-presets">
        {PRESETS.map(([label, ms]) => (
          <button key={label} className={`pip-btn${c.duration === ms ? ' is-active' : ''}`} onClick={() => set(ms, false)}>
            {label}
          </button>
        ))}
      </div>
    </InvDetail>
  )
}

function StopwatchDetail({ timers, now, onToggle }: { timers: Timers; now: number; onToggle: () => void }) {
  const sw = timers.stopwatch
  const m = meta('stopwatch')
  const elapsed = elapsedOf(sw, now)
  const running = sw.startedAt != null
  const laps = lapDurations(sw.laps)
  const best = laps.length > 1 ? Math.min(...laps) : -1
  return (
    <InvDetail title={m.name} sub={running ? 'RUNNING' : elapsed ? 'HALTED' : 'READY'} icon={m.icon} wgVal={m.wgVal} stats={[['LAPS', sw.laps.length]]}>
      <Readout text={fmtStopwatch(elapsed)} state={running ? 'running' : elapsed ? 'paused' : 'idle'} />
      <div className="pip-choices">
        <button className={`pip-btn${running ? '' : ' is-active'}`} onClick={onToggle}>
          {running ? '[ STOP ]' : elapsed ? '[ RESUME ]' : '[ START ]'}
        </button>
        <button className="pip-btn" disabled={!running} onClick={() => writeTimers((t) => ({ ...t, stopwatch: lapStopwatch(t.stopwatch, Date.now()) }))}>
          [ LAP ]
        </button>
        <button className="pip-btn" disabled={!elapsed} onClick={() => writeTimers((t) => ({ ...t, stopwatch: newStopwatch() }))}>
          [ RESET ]
        </button>
      </div>
      {laps.length > 0 && (
        <ol className="tool-laps" reversed>
          {laps
            .map((d, i) => (
              <li key={i} className={d === best ? 'is-best' : undefined}>
                <span>LAP {i + 1}</span>
                <span>{fmtStopwatch(d)}</span>
                <span>{fmtStopwatch(sw.laps[i])}</span>
              </li>
            ))
            .reverse()}
        </ol>
      )}
    </InvDetail>
  )
}

type ConvState = { cat: string; from: string; to: string; value: string }

function ConvertDetail() {
  const m = meta('convert')
  const [st, setSt] = useStored<ConvState>('tools:convert', { cat: 'length', from: 'mi', to: 'km', value: '1' })
  const cat = categoryOf(st.cat)
  const from = cat.units.some((u) => u.id === st.from) ? st.from : cat.from
  const to = cat.units.some((u) => u.id === st.to) ? st.to : cat.to
  const n = Number(st.value.replace(',', '.'))
  const ok = st.value.trim() !== '' && Number.isFinite(n)
  const result = ok ? fmtNum(convert(n, cat.id, from, to)) : '—'
  const label = (id: string) => cat.units.find((u) => u.id === id)?.label ?? id
  const unitSelect = (value: string, key: 'from' | 'to', aria: string) => (
    <select className="tool-select" value={value} aria-label={aria} onChange={(e) => setSt({ ...st, cat: cat.id, from, to, [key]: e.target.value })}>
      {cat.units.map((u) => (
        <option key={u.id} value={u.id}>
          {u.label}
        </option>
      ))}
    </select>
  )
  return (
    <InvDetail title={m.name} sub={`MODE: ${cat.label}`} icon={m.icon} wgVal={m.wgVal} stats={[['MODES', CATEGORIES.length]]}>
      <div className="pip-choices tool-presets" role="group" aria-label="Measurement">
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`pip-btn${c.id === cat.id ? ' is-active' : ''}`} aria-pressed={c.id === cat.id} onClick={() => setSt({ ...st, cat: c.id, from: c.from, to: c.to })}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="tool-convert">
        <input
          id="tool-input-convert"
          className="tool-num"
          inputMode="decimal"
          autoComplete="off"
          aria-label="Value"
          value={st.value}
          onChange={(e) => setSt({ ...st, value: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
        />
        {unitSelect(from, 'from', 'From unit')}
        <button className="pip-btn tool-swap" aria-label="Swap units" onClick={() => setSt({ ...st, cat: cat.id, from: to, to: from })}>
          ⇄
        </button>
        {unitSelect(to, 'to', 'To unit')}
      </div>
      <p className="tool-result">
        <span>=</span> {result} <small>{label(to)}</small>
      </p>
      {ok && (
        <p className="inv-copy">
          1 {label(from)} = {fmtNum(convert(1, cat.id, from, to))} {label(to)}
        </p>
      )}
    </InvDetail>
  )
}

const KEYS = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '%', '+', '(', ')', '⌫', 'C']
type Tape = { expr: string; value: number }[]

function CalcDetail() {
  const m = meta('calc')
  const [expr, setExpr] = useStored('tools:calc:expr', '')
  const [tape, setTape] = useStored<Tape>('tools:calc:tape', [])
  const inputRef = useRef<HTMLInputElement>(null)
  const value = useMemo(() => evaluate(expr), [expr])

  const commit = () => {
    if (value == null) return
    setTape((t) => [{ expr, value }, ...t].slice(0, 6))
    setExpr(fmtNum(value))
  }
  const press = (k: string) => {
    if (k === 'C') setExpr('')
    else if (k === '⌫') setExpr(expr.slice(0, -1))
    else setExpr(expr + k)
  }
  return (
    <InvDetail title={m.name} sub="+ − × ÷ % ^ ( ) // ENTER TO TOTAL" icon={m.icon} wgVal={m.wgVal} stats={[['TAPE', tape.length]]}>
      <form
        className="tool-row"
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
      >
        <label className="inv-search">
          <span aria-hidden>&gt;</span>
          <input
            id="tool-input-calc"
            ref={inputRef}
            value={expr}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="2 * (3 + 4)"
            aria-label="Expression"
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
          />
        </label>
        <button className="pip-btn is-active" type="submit" disabled={value == null}>
          [ = ]
        </button>
      </form>
      <p className="tool-result">
        <span>=</span> {expr.trim() ? (value == null ? '…' : fmtNum(value)) : '0'}
      </p>
      <div className="tool-keypad">
        {KEYS.map((k) => (
          <button key={k} className="pip-btn" onClick={() => press(k)} aria-label={k === '⌫' ? 'Backspace' : k === 'C' ? 'Clear' : k}>
            {k}
          </button>
        ))}
      </div>
      {tape.length > 0 && (
        <ul className="tool-tape" aria-label="Recent results">
          {tape.map((t, i) => (
            <li key={i}>
              <button
                onClick={() => {
                  setExpr(expr + fmtNum(t.value))
                  inputRef.current?.focus()
                }}
              >
                <span>{t.expr}</span>
                <span>= {fmtNum(t.value)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </InvDetail>
  )
}
