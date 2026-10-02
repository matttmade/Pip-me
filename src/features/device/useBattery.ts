import { useSyncExternalStore } from 'react'

type BatteryManagerLike = EventTarget & { level: number; charging: boolean }
type Status = { level: number; charging: boolean }

const FULL: Status = { level: 1, charging: false }
let status: Status = FULL
let started = false
const listeners = new Set<() => void>()

function start() {
  if (started) return
  started = true
  const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManagerLike> }
  // Battery Status API is Chromium-only; everyone else reports 100/100.
  nav.getBattery?.()
    .then((b) => {
      const read = () => {
        status = { level: Math.min(Math.max(b.level, 0), 1), charging: b.charging }
        listeners.forEach((fn) => fn())
      }
      read()
      b.addEventListener('levelchange', read)
      b.addEventListener('chargingchange', read)
    })
    .catch(() => {})
}

function subscribe(fn: () => void) {
  start()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** HP in the status bar. level is 0-1. */
export function useBattery(): { level: number; charging: boolean } {
  return useSyncExternalStore(subscribe, () => status, () => FULL)
}
