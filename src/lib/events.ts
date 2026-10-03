export type AppEvent =
  | { type: 'quest-complete'; xp: number }
  | { type: 'level-up'; level: number }
  | { type: 'figure-tapped' }
  | { type: 'hack-result'; success: boolean; daily: boolean }
  | { type: 'holotape-import'; count: number }
  | { type: 'tab-change'; tab: string }
  | { type: 'subtab-change'; sub: string }
  | { type: 'list-move' }
  | { type: 'list-select' }
  | { type: 'map-located' }
  | { type: 'radio-tuned'; station: string }
  | { type: 'glitch'; strength: number }

type Handler<E> = (e: E) => void
const handlers = new Map<string, Set<Handler<AppEvent>>>()

export function emit(e: AppEvent): void {
  handlers.get(e.type)?.forEach((h) => h(e))
  handlers.get('*')?.forEach((h) => h(e))
}

/** Subscribe to one event type, or '*' for everything. Returns an unsubscribe fn. */
export function on<T extends AppEvent['type'] | '*'>(
  type: T,
  fn: Handler<T extends '*' ? AppEvent : Extract<AppEvent, { type: T }>>,
): () => void {
  let set = handlers.get(type)
  if (!set) handlers.set(type, (set = new Set()))
  set.add(fn as Handler<AppEvent>)
  return () => set.delete(fn as Handler<AppEvent>)
}
