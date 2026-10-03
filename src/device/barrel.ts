/**
 * CRT barrel distortion as an feDisplacementMap map.
 * For output pixel p (normalized -1..1) we sample p·(1 + k·r²), so the picture bulges
 * and the corners fall outside the tube (black overscan), like a curved CRT.
 * R encodes x displacement, G encodes y; 0.5 (=128) means no shift.
 */
export type BarrelMap = { width: number; height: number; data: Uint8ClampedArray; scale: number }

export function barrelMap(mapW: number, mapH: number, screenW: number, screenH: number, k: number): BarrelMap {
  const data = new Uint8ClampedArray(mapW * mapH * 4)
  // displacement range covers the corner (r² = 2) on the longer axis
  const scale = Math.max(1, 2 * 2 * k * (Math.max(screenW, screenH) / 2))
  for (let y = 0; y < mapH; y++) {
    const v = ((y + 0.5) / mapH) * 2 - 1
    for (let x = 0; x < mapW; x++) {
      const u = ((x + 0.5) / mapW) * 2 - 1
      const r2 = u * u + v * v
      const dx = u * k * r2 * (screenW / 2) // px
      const dy = v * k * r2 * (screenH / 2)
      const i = (y * mapW + x) * 4
      data[i] = Math.round((0.5 + dx / scale) * 255)
      data[i + 1] = Math.round((0.5 + dy / scale) * 255)
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }
  return { width: mapW, height: mapH, data, scale }
}

/** EffectsConfig.curvature (0-1) → barrel coefficient. */
export const curvatureToK = (curvature: number) => Math.max(0, Math.min(1, curvature)) * 0.045
