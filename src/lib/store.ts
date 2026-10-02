import { useCallback, useSyncExternalStore } from 'react'

/** Flip to 'local' to make every customization survive browser restarts. */
export const persistence: 'session' | 'local' = 'session'

export const PREFIX = 'pipboy:v1:'

/**
 * Keys starting with `saved:` (e.g. user-saved system presets) always live in localStorage
 * so they survive closing the browser, whatever `persistence` says. RESET TERMINAL keeps them.
 */
export const SAVED_PREFIX = 'saved:'
const scopeOf = (key: string): 'session' | 'local' => (key.startsWith(SAVED_PREFIX) ? 'local' : persistence)

type Updater<T> = T | ((prev: T) => T)

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function storage(scope: 'session' | 'local' = persistence): Storage | null {
  try {
    return scope === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

function notify(key?: string) {
  if (key) listeners.get(key)?.forEach((fn) => fn())
  else listeners.forEach((set) => set.forEach((fn) => fn()))
}

export function readStored<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T
  let value = initial
  try {
    const raw = storage(scopeOf(key))?.getItem(PREFIX + key)
    if (raw != null) value = JSON.parse(raw) as T
  } catch {
    // corrupt or unavailable storage: fall back to the initial value
  }
  cache.set(key, value)
  return value
}

export function writeStored<T>(key: string, next: Updater<T>, initial?: T): T {
  const prev = readStored(key, initial as T)
  const value = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
  cache.set(key, value)
  try {
    storage(scopeOf(key))?.setItem(PREFIX + key, JSON.stringify(value))
  } catch (err) {
    console.warn(`[store] could not persist "${key}"`, err)
  }
  notify(key)
  return value
}

export function subscribeStored(key: string, fn: () => void): () => void {
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(fn)
  return () => set.delete(fn)
}

/** Session-persisted state. The only sanctioned way to touch web storage. */
export function useStored<T>(key: string, initial: T): [T, (v: Updater<T>) => void] {
  const subscribe = useCallback((fn: () => void) => subscribeStored(key, fn), [key])
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key, initial),
    () => initial,
  )
  const set = useCallback((v: Updater<T>) => void writeStored(key, v, initial), [key, initial])
  return [value, set]
}

/** Clears every pipboy:v1:* key (except saved:* keys) and resets subscribers to their initial values. */
export function resetAll(): void {
  const s = storage()
  if (s) {
    const doomed: string[] = []
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)
      if (k?.startsWith(PREFIX) && !k.startsWith(PREFIX + SAVED_PREFIX)) doomed.push(k)
    }
    doomed.forEach((k) => s.removeItem(k))
  }
  for (const k of [...cache.keys()]) if (!k.startsWith(SAVED_PREFIX)) cache.delete(k)
  notify()
}
