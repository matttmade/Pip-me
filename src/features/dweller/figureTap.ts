import type { Pt } from './weaponFx'

/**
 * Tiny bus between the figure scenes and the STATUS weapon slot: a tap on the figure is
 * offered to the equipped weapon first. Returns true when the weapon handled it.
 */
type Handler = (at: Pt | null) => boolean
let handler: Handler | null = null

export function figureTap(at: Pt | null): boolean {
  return handler ? handler(at) : false
}

export function onFigureTap(fn: Handler): () => void {
  handler = fn
  return () => {
    if (handler === fn) handler = null
  }
}
