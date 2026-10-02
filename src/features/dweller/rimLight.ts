import type { Material, WebGLProgramParametersWithUniforms } from 'three'

const PATCHED = Symbol('pipRim')

/**
 * Add a view-space fresnel rim to a lit three.js material (Lambert/Phong/Standard), so the
 * silhouette catches light and pops off the dark screen. Idempotent per material.
 */
export function addRimLight(material: Material, strength: number, power = 2.6): void {
  const m = material as Material & { [PATCHED]?: boolean }
  if (strength <= 0 || m[PATCHED] || !('isMeshLambertMaterial' in m || 'isMeshStandardMaterial' in m || 'isMeshPhongMaterial' in m)) return
  m[PATCHED] = true
  const prev = m.onBeforeCompile
  m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    prev.call(m, shader, renderer)
    shader.uniforms.rimStrength = { value: strength }
    shader.uniforms.rimPower = { value: power }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float rimStrength;\nuniform float rimPower;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        `float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), rimPower);
        outgoingLight += vec3(rimStrength * rimF);
        #include <opaque_fragment>`,
      )
  }
  const key = m.customProgramCacheKey.bind(m)
  m.customProgramCacheKey = () => `${key()}|rim:${strength}:${power}`
  m.needsUpdate = true
}
