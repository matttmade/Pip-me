import {
  HalfFloatType,
  PerspectiveCamera,
  Scene,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { safeTargetOptions } from '../webgl'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { mulberry32 } from '../../../lib/contracts'
import { renderSize } from '../fidelity'
import { GestureDirector, hueToHex, WALK_CLIP, type Command } from './behavior'
import { BLOOM, HueSafeShader } from './phosphor'
import { VaultBoy } from './VaultBoy'

export const VAULTBOY_URL = `${import.meta.env.BASE_URL}models/vaultboy.glb`

const FRAME_MS = 1000 / 30
const TARGET = new Vector3(0, 0.9, 0)
const DIST = 4.7
const CAM_Y = 1.15
const BASE_YAW = (10 * Math.PI) / 180
const ORBIT = (14 * Math.PI) / 180
const STILL_POSE = 'thumbsUp'

export type VaultBoyEngineOptions = { hue: number; glow: number; animate: boolean; coarse: boolean }

export type VaultBoyEngine = {
  setHue(hue: number): void
  setGlow(glow: number): void
  setRunning(running: boolean): void
  resize(cssW: number, cssH: number, dpr: number): void
  /** Play a gesture now (tap / app event). Returns false when swallowed. */
  react(name: string): boolean
  dispose(): void
}

/**
 * The kit's renderer output is opaque black. The Pip screen is not quite black, so turn
 * brightness into alpha (premultiplied): black stays see-through, glow adds onto the screen.
 */
const ScreenAlphaShader = {
  name: 'ScreenAlphaShader',
  uniforms: { tDiffuse: { value: null as Texture | null }, uFloor: { value: 0.05 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uFloor; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      // drop the faint bloom haze floor and fade it out toward the canvas edges,
      // so the canvas never shows as a lighter rectangle on the screen
      vec2 e = min(vUv, 1.0 - vUv);
      float edge = smoothstep(0.0, 0.14, min(e.x, e.y));
      float m = max(c.r, max(c.g, c.b));
      float keep = m > 1e-4 ? max(m - uFloor * (2.0 - edge), 0.0) / m : 0.0;
      c *= keep * mix(0.0, 1.0, edge);
      gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
    }`,
}

export async function createVaultBoyEngine(canvas: HTMLCanvasElement, opts: VaultBoyEngineOptions): Promise<VaultBoyEngine> {
  const vb = await VaultBoy.load(VAULTBOY_URL, { style: { color: hueToHex(opts.hue) } })
  try {
    return buildEngine(canvas, vb, opts)
  } catch (err) {
    vb.dispose()
    throw err
  }
}

function buildEngine(canvas: HTMLCanvasElement, vb: VaultBoy, opts: VaultBoyEngineOptions): VaultBoyEngine {
  const animate = opts.animate
  // The 1px mesh wire turns to mush at 1x: always render at least 2x and let the browser scale down.
  const maxDpr = 2
  const maxPixels = opts.coarse ? 620_000 : 1_200_000
  let width = canvas.width || 240
  let height = canvas.height || 320

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 1)

  const scene = new Scene()
  scene.add(vb.object)
  const camera = new PerspectiveCamera(30, width / height, 0.05, 30)

  const target = new WebGLRenderTarget(width, height, safeTargetOptions(renderer, 4) as { type: typeof HalfFloatType; samples: number })
  const composer = new EffectComposer(renderer, target)
  composer.setPixelRatio(1)
  composer.setSize(width, height)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(width, height), BLOOM.strength, BLOOM.radius, BLOOM.threshold)
  composer.addPass(bloom)
  const hueSafe = new ShaderPass(HueSafeShader)
  composer.addPass(hueSafe)
  composer.addPass(new OutputPass())
  const screenAlpha = new ShaderPass(ScreenAlphaShader)
  composer.addPass(screenAlpha)

  const applyHue = (hue: number) => vb.setColor(hueToHex(hue))
  const applyGlow = (glow: number) => {
    const g = Math.min(1, Math.max(0, glow))
    bloom.strength = BLOOM.strength * (0.3 + 0.9 * g)
    bloom.enabled = g > 0.01
  }
  applyHue(opts.hue)
  applyGlow(opts.glow)

  const director = new GestureDirector(mulberry32((Math.random() * 2 ** 31) | 0))
  const apply = (c: Command) => {
    if (c.type === 'pose') vb.pose(c.name, 450)
    else vb.play(c.name, 0.45)
  }
  if (animate) vb.play(WALK_CLIP, 0)
  else {
    vb.breathe = false
    vb.poseNow(STILL_POSE)
  }

  let time = 0
  let raf = 0
  let last = 0
  let disposed = false

  const draw = (dt: number) => {
    if (disposed) return
    if (animate) {
      const c = director.tick(dt)
      if (c) apply(c)
      vb.update(dt)
    }
    const yaw = BASE_YAW + (animate ? ORBIT * Math.sin(time * 0.3) : 0)
    camera.position.set(Math.sin(yaw) * DIST, CAM_Y, Math.cos(yaw) * DIST)
    camera.lookAt(TARGET)
    scene.updateMatrixWorld()
    composer.render()
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now - last < FRAME_MS - 2) return
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    time += dt
    draw(dt)
  }

  const setRunning = (run: boolean) => {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
    if (run && animate && !disposed) raf = requestAnimationFrame(tick)
    else draw(0)
  }

  draw(0)

  return {
    setHue(hue) {
      applyHue(hue)
      if (!raf) draw(0)
    },
    setGlow(glow) {
      applyGlow(glow)
      if (!raf) draw(0)
    },
    resize(cssW, cssH, dpr) {
      if (disposed) return
      const s = renderSize(cssW, cssH, Math.max(dpr, maxDpr), maxDpr, maxPixels)
      if (s.width === width && s.height === height) return
      width = s.width
      height = s.height
      renderer.setSize(width, height, false)
      composer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      if (!raf) draw(0)
    },
    react(name) {
      if (disposed) return false
      if (!animate) {
        vb.poseNow(name)
        draw(0)
        return true
      }
      const c = director.react(name)
      if (c) apply(c)
      return !!c
    },
    setRunning,
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      vb.dispose()
      bloom.dispose()
      hueSafe.dispose()
      screenAlpha.dispose()
      composer.dispose()
      target.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
