import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  Color,
  DirectionalLight,
  MeshBasicMaterial,
  MeshLambertMaterial,
  ShaderMaterial,
  SkinnedMesh,
  Vector3,
  type Object3D,
  type Scene,
  type Texture,
} from 'three'
import { pipRgb } from '../../../lib/contracts'

export type SolidWireLook = {
  /** the model's triangle wire (0 = off: the mesh is dense and irregular, so it reads as noise) */
  wireOpacity: number
  /** hologram scan bands across the body (bands per model unit, 0 = off): a smooth texture instead of the mesh wire */
  bands?: number
  /** key / back / ambient light: lower key + more fill = more mid-tones for the dither */
  key: number
  back: number
  fill: number
}

/** Smooth dithered shading (no wire, no bands); soft light so more of him sits in the dithered mid-tones. */
export const SOLID_WIRE_LOOK: SolidWireLook = { wireOpacity: 0, bands: 0, key: 1.8, back: 0.7, fill: 0.3 }

/**
 * "Solid wireframe" look (owner pick #2): an opaque, lit grey body hides back faces,
 * smooth dithered shading, a fresnel rim and a black ink outline define the
 * silhouette. Everything is greyscale; the Bayer dither pass maps brightness onto the
 * phosphor ramp, so the screen colour drives the final look.
 */
export function applySolidWire(root: Object3D, scene: Scene, look: SolidWireLook = SOLID_WIRE_LOOK): { dispose(): void } {
  const meshes: SkinnedMesh[] = []
  root.traverse((o) => (o as SkinnedMesh).isSkinnedMesh && meshes.push(o as SkinnedMesh))
  const [body, kitWire] = meshes
  const owned: { dispose(): void }[] = []
  if (!body) return { dispose() {} }
  if (!body.geometry.attributes.normal) body.geometry.computeVertexNormals()

  const bodyMat = new MeshLambertMaterial({ color: 0xb4b4b4, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  body.material = bodyMat
  owned.push(bodyMat)

  const wireMat = new MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: look.wireOpacity })
  if (kitWire) {
    kitWire.material = wireMat
    kitWire.visible = look.wireOpacity > 0
  }
  owned.push(wireMat)

  const extra = (mat: ShaderMaterial | MeshBasicMaterial, order: number) => {
    const m = new SkinnedMesh(body.geometry, mat)
    m.bind(body.skeleton, body.bindMatrix)
    m.frustumCulled = false
    m.renderOrder = order
    body.parent!.add(m)
    owned.push(mat, { dispose: () => m.removeFromParent() })
    return m
  }

  // fresnel rim: brightens the edges facing away from the camera
  extra(
    new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      vertexShader: /* glsl */ `#include <common>
        #include <skinning_pars_vertex>
        varying float vR;
        void main(){
          #include <skinbase_vertex>
          #include <beginnormal_vertex>
          #include <skinnormal_vertex>
          #include <begin_vertex>
          #include <skinning_vertex>
          vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
          vec3 n = normalize(normalMatrix * objectNormal);
          vR = pow(1.0 - abs(dot(n, normalize(-mv.xyz))), 2.5);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vR; void main(){ gl_FragColor = vec4(vec3(0.9 * vR), vR); }`,
    }),
    2,
  )

  // hologram bands: even horizontal lines in bind-pose space, so they ride on the body as it moves
  if (look.bands) {
    extra(
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        uniforms: { uFreq: { value: look.bands } },
        vertexShader: /* glsl */ `#include <common>
          #include <skinning_pars_vertex>
          varying float vY;
          void main(){
            vY = position.y;
            #include <skinbase_vertex>
            #include <begin_vertex>
            #include <skinning_vertex>
            gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
          }`,
        fragmentShader: /* glsl */ `uniform float uFreq; varying float vY;
          void main(){
            float t = vY * uFreq;
            float d = abs(fract(t) - 0.5) / fwidth(t);
            float a = 1.0 - smoothstep(0.0, 1.2, d);
            gl_FragColor = vec4(vec3(0.55 * a), a);
          }`,
      }),
      1,
    )
  }

  // ink outline: inverted hull pushed out along the skinned normal (world-size thickness)
  body.updateMatrixWorld(true)
  const scale = body.getWorldScale(new Vector3()).x || 1
  const outlineMat = new MeshBasicMaterial({ color: 0x000000, side: BackSide })
  outlineMat.onBeforeCompile = (sh) => {
    sh.uniforms.uThick = { value: 0.016 / scale }
    sh.vertexShader = sh.vertexShader
      .replace('void main() {', 'uniform float uThick;\nvoid main() {')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\n  transformed += normalize(objectNormal) * uThick;')
  }
  extra(outlineMat, -1)

  // key from the front, a little high and left (beside the camera), a back rim light, low fill
  const key = new DirectionalLight(0xffffff, look.key)
  key.position.set(-1.3, 2.4, 4.2)
  const back = new DirectionalLight(0xffffff, look.back)
  back.position.set(3, 2, -3)
  const fill = new AmbientLight(0xffffff, look.fill)
  scene.add(key, back, fill)
  owned.push({ dispose: () => scene.remove(key, back, fill) })

  return { dispose: () => owned.forEach((o) => o.dispose()) }
}

/** 4×4 Bayer ordered dither: brightness → 4 phosphor tones; black stays transparent. */
export const DitherShader = {
  name: 'PipDitherShader',
  uniforms: {
    tDiffuse: { value: null as Texture | null },
    c1: { value: new Color() },
    c2: { value: new Color() },
    c3: { value: new Color() },
    uPx: { value: 3.0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec3 c1, c2, c3; uniform float uPx; varying vec2 vUv;
    float bayer(vec2 p){
      vec2 q = mod(floor(p), 4.0);
      float i = q.x + q.y * 4.0;
      // 4x4 Bayer matrix, row-major
      float m = i < 1.0 ? 0.0 : i < 2.0 ? 8.0 : i < 3.0 ? 2.0 : i < 4.0 ? 10.0 :
                i < 5.0 ? 12.0 : i < 6.0 ? 4.0 : i < 7.0 ? 14.0 : i < 8.0 ? 6.0 :
                i < 9.0 ? 3.0 : i < 10.0 ? 11.0 : i < 11.0 ? 1.0 : i < 12.0 ? 9.0 :
                i < 13.0 ? 15.0 : i < 14.0 ? 7.0 : i < 15.0 ? 13.0 : 5.0;
      return (m + 0.5) / 16.0;
    }
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      float l = pow(max(col.r, max(col.g, col.b)), 0.5); // linear -> roughly perceptual
      float q = clamp(floor(l * 3.0 + bayer(gl_FragCoord.xy / uPx)) / 3.0, 0.0, 1.0);
      vec3 o = q < 0.34 ? c1 * (q * 3.0) : q < 0.67 ? mix(c1, c2, (q - 0.333) * 3.0) : mix(c2, c3, (q - 0.667) * 3.0);
      float a = q < 0.01 ? 0.0 : 1.0;
      gl_FragColor = vec4(o * a, a); // premultiplied: empty pixels let the screen show through
    }`,
}

/** Phosphor tones for the dither pass from the app hue. */
export function setDitherHue(u: (typeof DitherShader)['uniforms'], hue: number, glow = 1) {
  const g = 0.75 + 0.25 * Math.min(1, Math.max(0, glow))
  const set = (c: Color, l: number) => {
    const [r, gg, b] = pipRgb(hue, l)
    c.setRGB((r / 255) * g, (gg / 255) * g, (b / 255) * g)
  }
  set(u.c1.value, 0.16)
  set(u.c2.value, 0.48)
  set(u.c3.value, 0.8)
}
