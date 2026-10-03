/**
 * Signed distance fields for map icons, so MapLibre can tint (`icon-color`) and glow
 * (`icon-halo-*`) them. Same encoding as MapLibre glyphs: the edge sits at 0.75 (191),
 * inside rises toward 255, outside falls off over `radius` px.
 */

const INF = 1e20

/** 1D squared Euclidean distance transform (Felzenszwalb & Huttenlocher). */
function edt1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array) {
  v[0] = 0
  z[0] = -INF
  z[1] = INF
  f[0] = grid[offset]
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride]
    const q2 = q * q
    do {
      const r = v[k]
      s = (f[q] - f[r] + q2 - r * r) / (q - r) / 2
    } while (s <= z[k] && --k > -1)
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = INF
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1] < q) k++
    const r = v[k]
    const qr = q - r
    grid[offset + q * stride] = f[r] + qr * qr
  }
}

function edt(grid: Float64Array, width: number, height: number) {
  const n = Math.max(width, height)
  const f = new Float64Array(n)
  const v = new Uint16Array(n)
  const z = new Float64Array(n + 1)
  for (let x = 0; x < width; x++) edt1d(grid, x, width, height, f, v, z)
  for (let y = 0; y < height; y++) edt1d(grid, y * width, 1, width, f, v, z)
}

/**
 * Coverage (0-255 per pixel, e.g. a canvas alpha channel) → SDF bytes.
 * Anti-aliased edge pixels are placed sub-pixel, like tiny-sdf.
 */
export function alphaToSdf(alpha: ArrayLike<number>, width: number, height: number, radius = 8, cutoff = 0.25): Uint8ClampedArray {
  const size = width * height
  const outer = new Float64Array(size)
  const inner = new Float64Array(size)
  for (let i = 0; i < size; i++) {
    const a = alpha[i] / 255
    if (a >= 1) {
      outer[i] = 0
      inner[i] = INF
    } else if (a <= 0) {
      outer[i] = INF
      inner[i] = 0
    } else {
      const d = 0.5 - a
      outer[i] = d > 0 ? d * d : 0
      inner[i] = d < 0 ? d * d : 0
    }
  }
  edt(outer, width, height)
  edt(inner, width, height)
  const out = new Uint8ClampedArray(size)
  for (let i = 0; i < size; i++) {
    const d = Math.sqrt(outer[i]) - Math.sqrt(inner[i])
    out[i] = Math.round(255 - 255 * (d / radius + cutoff))
  }
  return out
}

/** SDF bytes → RGBA image for map.addImage(…, { sdf: true }) (MapLibre reads alpha). */
export function sdfToRgba(sdf: Uint8ClampedArray): Uint8Array {
  const data = new Uint8Array(sdf.length * 4)
  for (let i = 0; i < sdf.length; i++) {
    data[i * 4] = 255
    data[i * 4 + 1] = 255
    data[i * 4 + 2] = 255
    data[i * 4 + 3] = sdf[i]
  }
  return data
}
