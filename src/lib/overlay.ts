import { useSyncExternalStore } from 'react'

export type OverlayId = 'terminal' | 'headshot-crop'
export type OverlayState = { id: OverlayId; payload?: unknown } | null

let state: OverlayState = null
const subs = new Set<() => void>()
const set = (s: OverlayState) => {
  state = s
  subs.forEach((fn) => fn())
}

/** Full-screen views launched from anywhere (holotape → terminal, upload → cropper). */
export const openOverlay = (id: OverlayId, payload?: unknown) => set({ id, payload })
export const closeOverlay = () => set(null)

export const useOverlay = () =>
  useSyncExternalStore(
    (fn) => (subs.add(fn), () => subs.delete(fn)),
    () => state,
    () => null,
  )
