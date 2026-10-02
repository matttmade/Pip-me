import { hslToRgb } from '../effects/color'

/**
 * PC-style Pip cursors, redrawn as SVG in the current phosphor hue: an arrow for
 * pointing, corner brackets around a dot for anything clickable, and a dot while dragging.
 * Each is a CSS `cursor` value with its hotspot.
 */
export type CursorSet = { arrow: string; hover: string; drag: string }

const hex = (hue: number, l: number) =>
  '#' + hslToRgb(hue, 1, l).map((v) => v.toString(16).padStart(2, '0')).join('')

const OUTLINE = '#10140c'

function svg(size: number, body: string, glow: string): string {
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%">` +
    `<feGaussianBlur stdDeviation="1.4" result="b"/><feFlood flood-color="${glow}" flood-opacity=".75"/>` +
    `<feComposite in2="b" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<g filter="url(#g)">${body}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`
}

export function buildCursors(hue: number): CursorSet {
  const fill = hex(hue, 0.6)
  const glow = hex(hue, 0.5)
  const stroke = `stroke="${OUTLINE}" stroke-width="1.6" stroke-linejoin="round"`
  // arrow: tip at (4,3), notched base; hotspot at the tip
  const arrow = svg(32, `<path d="M4 3 L4 25 L10 20 L23 21 Z" fill="${fill}" ${stroke}/>`, glow)
  // hover: four corner brackets around a dot, hotspot centered
  const c = 16
  const r = 9 // half-size of the bracket square
  const l = 4.5 // bracket arm length
  const corners = [
    [c - r, c - r, 1, 1],
    [c + r, c - r, -1, 1],
    [c - r, c + r, 1, -1],
    [c + r, c + r, -1, -1],
  ]
    .map(([x, y, dx, dy]) => `M${x + dx * l} ${y} L${x} ${y} L${x} ${y + dy * l}`)
    .join(' ')
  const hover = svg(
    32,
    `<path d="${corners}" fill="none" stroke="${OUTLINE}" stroke-width="4.2" stroke-linecap="square"/>` +
      `<path d="${corners}" fill="none" stroke="${fill}" stroke-width="2.2" stroke-linecap="square"/>` +
      `<circle cx="${c}" cy="${c}" r="2.8" fill="${fill}" ${stroke}/>`,
    glow,
  )
  const drag = svg(32, `<circle cx="${c}" cy="${c}" r="3" fill="${fill}" ${stroke}/>`, glow)
  return {
    arrow: `${arrow} 4 3, default`,
    hover: `${hover} ${c} ${c}, pointer`,
    drag: `${drag} ${c} ${c}, grabbing`,
  }
}
