/** HSL (h 0-360, s/l 0-1) → [r, g, b] 0-255. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

/** Phosphor saturation, the same as --pip-sat in tokens.css: a soft mint, not neon. */
export const PIP_SAT = 0.6

/** The same colors as tokens.css, for canvas/WebGL code that can't read CSS vars. */
export const pipRgb = (hue: number, lightness = 0.6) => hslToRgb(hue, PIP_SAT, lightness)
