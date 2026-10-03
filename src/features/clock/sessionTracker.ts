import { on } from '../../lib/events'
// Module-level tracking runs outside React, so it uses the store's non-hook accessors.
import { readStored, subscribeStored, useStored, writeStored } from '../../lib/store'
import { getRadioState, subscribeRadio } from '../radio/engine'
import { isPlaying } from '../radio/radioState'
import { bootSession, EMPTY_SESSION, radioTick, reduceSession, SESSION_KEY, type SessionLog } from './sessionLog'

let stop: (() => void) | null = null

const playing = () => isPlaying(getRadioState())
const read = () => readStored<SessionLog>(SESSION_KEY, EMPTY_SESSION)
function update(fn: (s: SessionLog) => SessionLog) {
  const prev = read()
  const next = fn(prev)
  if (next !== prev) writeStored(SESSION_KEY, next, EMPTY_SESSION)
}

/**
 * Feed the SESSION LOG from app events and the radio. Idempotent; started by the
 * always-mounted status bar (via useDaylight) so it counts from boot.
 */
export function startSessionTracking(): void {
  if (stop) return
  update((s) => bootSession(s, playing(), Date.now()))
  const offEvents = on('*', (e) => update((s) => reduceSession(s, e, Date.now())))
  const offRadio = subscribeRadio(() => update((s) => radioTick(s, playing(), Date.now())))
  // RESET TERMINAL wipes the key: re-stamp the boot time.
  const offReset = subscribeStored(SESSION_KEY, () => {
    if (!read().bootAt) update((s) => bootSession(s, playing(), Date.now()))
  })
  stop = () => {
    offEvents()
    offRadio()
    offReset()
  }
}

/** Test helper. */
export function stopSessionTracking(): void {
  stop?.()
  stop = null
}

export const useSessionLog = () => useStored<SessionLog>(SESSION_KEY, EMPTY_SESSION)[0]
