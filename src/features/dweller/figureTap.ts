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

/* Which way the figure faces (radians relative to the camera, 0 = at the viewer, + = screen-right),
   offered by a scene that can turn. null when the mounted figure can't. */
let facing: (() => number) | null = null

export const figureFacing = (): number | null => (facing ? facing() : null)

export function onFigureFacing(fn: () => number): () => void {
  facing = fn
  return () => {
    if (facing === fn) facing = null
  }
}

export function onFigureTap(fn: Handler): () => void {
  handler = fn
  return () => {
    if (handler === fn) handler = null
  }
}
