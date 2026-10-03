// Module-level timer state: it lives outside React so timers keep running (and ring)
// on any tab. State goes through the store's non-hook accessors, so a reload keeps it.
import { readStored, subscribeStored, writeStored } from '../../lib/store'
import { sfx } from '../sound/sfx'
import {
  completeFocus,
  countdown,
  finishCountdown,
  isDue,
  newFocus,
  newStopwatch,
  remainingOf,
  type Countdown,
  type Focus,
  type Stopwatch,
} from './timer'

export type Timers = { focus: Focus; countdown: Countdown; stopwatch: Stopwatch }
export const TIMERS_KEY = 'tools:timers'
export const NO_TIMERS: Timers = { focus: newFocus(), countdown: countdown(5 * 60_000), stopwatch: newStopwatch() }

export const readTimers = () => readStored<Timers>(TIMERS_KEY, NO_TIMERS)
export const writeTimers = (fn: (t: Timers) => Timers) => writeStored<Timers>(TIMERS_KEY, fn, NO_TIMERS)

let alarm: ReturnType<typeof setTimeout> | undefined

/** Fire anything that is due, then sleep until the next countdown ends. */
function arm() {
  clearTimeout(alarm)
  const now = Date.now()
  const t = readTimers()
  if (isDue(t.focus.timer, now)) {
    const wasFocus = t.focus.phase === 'focus'
    writeTimers((p) => ({ ...p, focus: completeFocus(p.focus) }))
    return ring(wasFocus ? 'FOCUS STIM WORN OFF' : 'BREAK OVER', wasFocus ? 'TAKE A BREAK. YOU EARNED IT.' : 'READY FOR ANOTHER DOSE?')
  }
  if (isDue(t.countdown, now)) {
    writeTimers((p) => ({ ...p, countdown: finishCountdown(p.countdown) }))
    return ring('COUNTDOWN COMPLETE', 'TIME IS UP, DWELLER.')
  }
  const waits = [t.focus.timer, t.countdown].filter((c) => c.startedAt != null).map((c) => remainingOf(c, now))
  // setTimeout caps near 24.8 days; re-arm in chunks so long timers stay exact.
  if (waits.length) alarm = setTimeout(arm, Math.min(Math.min(...waits) + 5, 3_600_000))
}

/* ---------- the alert: sound + an on-screen notice on whatever tab is showing ---------- */

let toast: HTMLElement | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined

function dismiss() {
  clearTimeout(toastTimer)
  toast?.remove()
  toast = null
}

export function ring(title: string, sub: string) {
  // sfx honors SYSTEM > SOUND and volume; three bursts read as an alarm
  for (let i = 0; i < 3; i++) setTimeout(() => sfx.levelUp(), i * 650)
  if (typeof document === 'undefined') return
  dismiss()
  const host = document.querySelector('.pip-layout') ?? document.querySelector('.pip-content') ?? document.body
  const el = document.createElement('div')
  el.className = 'inv-alert'
  el.setAttribute('role', 'alert')
  const t = document.createElement('span')
  t.className = 'inv-alert__title'
  t.textContent = title
  const s = document.createElement('span')
  s.className = 'inv-alert__sub'
  s.textContent = sub
  const ok = document.createElement('button')
  ok.className = 'pip-btn'
  ok.type = 'button'
  ok.textContent = '[ OK ]'
  ok.addEventListener('click', dismiss)
  el.append(t, s, ok)
  host.append(el)
  toast = el
  toastTimer = setTimeout(dismiss, 12_000)
}

let started = false
/** Idempotent; called when the INV module loads so alarms are armed from the first frame. */
export function startTimers() {
  if (started || typeof window === 'undefined') return
  started = true
  subscribeStored(TIMERS_KEY, arm)
  // RESET TERMINAL notifies every key, which re-arms from the cleared state
  arm()
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && arm())
}
