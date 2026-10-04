import { useSyncExternalStore } from 'react'

/** Chromium's install event, captured as early as possible (it can fire before React mounts). */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: BIPEvent | null = null
let installed = false
let openRequested = false
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function captureInstallEvents(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // we show our own prompt
    deferred = e as BIPEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

export async function runInstallPrompt(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  emit()
  return outcome === 'accepted'
}

/** Ask the prompt to open now (e.g. from DATA > SYSTEM), ignoring the dismiss timer. */
export function requestInstallPrompt(): void {
  openRequested = true
  emit()
}
export const consumeOpenRequest = () => {
  const r = openRequested
  openRequested = false
  return r
}

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.matchMedia?.('(display-mode: fullscreen)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const useInstallState = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => (installed ? 'installed' : deferred ? 'ready' : openRequested ? 'requested' : 'idle'),
    () => 'idle',
  )
