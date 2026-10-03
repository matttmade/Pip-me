import { useSyncExternalStore } from 'react'

type ConnectionLike = EventTarget & { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean }
type Nav = Navigator & { connection?: ConnectionLike; deviceMemory?: number; getBattery?: unknown }

export type Diagnostics = {
  online: boolean
  /** '4g' | '3g' | … when the Network Information API exists. */
  effectiveType: string | null
  /** Mbit/s estimate. */
  downlink: number | null
  rtt: number | null
  saveData: boolean
  width: number
  height: number
  dpr: number
  cores: number | null
  memory: number | null
  batterySensor: boolean
  timeZone: string
}

const nav = () => navigator as Nav

function read(): Diagnostics {
  const c = nav().connection
  let timeZone = 'LOCAL'
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'LOCAL'
  } catch {
    // keep LOCAL
  }
  return {
    online: navigator.onLine,
    effectiveType: c?.effectiveType ?? null,
    downlink: c?.downlink ?? null,
    rtt: c?.rtt ?? null,
    saveData: !!c?.saveData,
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.round(window.devicePixelRatio * 100) / 100,
    cores: navigator.hardwareConcurrency || null,
    memory: nav().deviceMemory ?? null,
    batterySensor: typeof nav().getBattery === 'function',
    timeZone,
  }
}

let snap: Diagnostics | null = null
const same = (a: Diagnostics, b: Diagnostics) => (Object.keys(a) as (keyof Diagnostics)[]).every((k) => a[k] === b[k])
function snapshot(): Diagnostics {
  const next = read()
  if (!snap || !same(snap, next)) snap = next
  return snap
}

function subscribe(fn: () => void) {
  const c = nav().connection
  window.addEventListener('online', fn)
  window.addEventListener('offline', fn)
  window.addEventListener('resize', fn)
  c?.addEventListener?.('change', fn)
  return () => {
    window.removeEventListener('online', fn)
    window.removeEventListener('offline', fn)
    window.removeEventListener('resize', fn)
    c?.removeEventListener?.('change', fn)
  }
}

const SERVER: Diagnostics = {
  online: true,
  effectiveType: null,
  downlink: null,
  rtt: null,
  saveData: false,
  width: 0,
  height: 0,
  dpr: 1,
  cores: null,
  memory: null,
  batterySensor: false,
  timeZone: 'LOCAL',
}

/** Live browser/device readouts for PIP-OS DIAGNOSTICS. */
export const useDiagnostics = (): Diagnostics => useSyncExternalStore(subscribe, snapshot, () => SERVER)
