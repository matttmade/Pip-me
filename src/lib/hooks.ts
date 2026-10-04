import { useSyncExternalStore } from 'react'

const visibilitySubscribe = (fn: () => void) => {
  document.addEventListener('visibilitychange', fn)
  return () => document.removeEventListener('visibilitychange', fn)
}

/** False while the browser tab is hidden. Every animation loop should pause on false. */
export const usePageVisible = () =>
  useSyncExternalStore(visibilitySubscribe, () => document.visibilityState !== 'hidden', () => true)

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', fn)
      return () => mq.removeEventListener('change', fn)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')
export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)')
