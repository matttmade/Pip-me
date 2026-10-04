let cached: boolean | undefined

/** Cheap WebGL capability probe (no three.js needed). */
export function hasWebGL(): boolean {
  if (cached !== undefined) return cached
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null
    cached = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cached = false
  }
  return cached
}

/**
 * Render-target settings the GPU can actually draw into. Half-float + MSAA targets need WebGL2
 * and a colour-buffer extension; some phones (older iOS especially) lack them, which leaves the
 * figure black or loses the context. Fall back to 8-bit / no MSAA there.
 */
export function safeTargetOptions(
  renderer: { capabilities: { isWebGL2: boolean }; extensions: { has: (n: string) => boolean } },
  samples: number,
): { type: number; samples: number } {
  const halfOk =
    renderer.capabilities.isWebGL2 &&
    (renderer.extensions.has('EXT_color_buffer_half_float') || renderer.extensions.has('EXT_color_buffer_float'))
  return { type: halfOk ? HALF_FLOAT : UNSIGNED_BYTE, samples: renderer.capabilities.isWebGL2 ? samples : 0 }
}
// three.js constants (HalfFloatType / UnsignedByteType), inlined so this file stays three-free
const HALF_FLOAT = 1016
const UNSIGNED_BYTE = 1009
