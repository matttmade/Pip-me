/** Tiny chart scaling for the phosphor forecast plots. Pure. */

export type Range = { min: number; max: number }

/** Min/max of a series, widened to at least `minSpan` so a flat line sits mid-plot. */
export function seriesRange(values: number[], minSpan = 4): Range | null {
  if (!values.length) return null
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max - min < minSpan) {
    const mid = (min + max) / 2
    min = mid - minSpan / 2
    max = mid + minSpan / 2
  }
  return { min, max }
}

/** Map a value in `r` to a y coordinate between `top` (max) and `bottom` (min). */
export const scaleY = (v: number, r: Range, top: number, bottom: number) =>
  bottom - ((v - r.min) / (r.max - r.min || 1)) * (bottom - top)

/** Centre x of slot `i` of `n` across `width` (slots of equal width). */
export const slotX = (i: number, n: number, width: number) => ((i + 0.5) * width) / Math.max(n, 1)

/**
 * Polyline points for a series spread across `width`, between `top` and `bottom`.
 * `0,40 10,32 …` with one decimal.
 */
export function sparkPoints(values: number[], width: number, top: number, bottom: number, minSpan = 4): string {
  const r = seriesRange(values, minSpan)
  if (!r) return ''
  return values.map((v, i) => `${+slotX(i, values.length, width).toFixed(1)},${+scaleY(v, r, top, bottom).toFixed(1)}`).join(' ')
}

/** Bar height for a 0-100 percentage over `height`; at least `floor` px when non-zero so it reads. */
export function pctHeight(pct: number, height: number, floor = 1): number {
  const p = Math.min(Math.max(pct, 0), 100)
  return p === 0 ? 0 : Math.max(floor, +((p / 100) * height).toFixed(1))
}

/** Gauge needle angle in degrees (-90 left … +90 right) for `v` on 0…max. */
export const gaugeAngle = (v: number, max: number) => -90 + (Math.min(Math.max(v, 0), max) / max) * 180
