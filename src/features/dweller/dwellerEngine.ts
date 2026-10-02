import {
  AmbientLight,
  CanvasTexture,
  DirectionalLight,
  HalfFloatType,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
  type Material,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { detailProfile, renderSize, scanPeriod, type DetailProfile } from './fidelity'
import { createGlbDweller, glbAvailable } from './glbDweller'
import { PipMonochromeShader, PipSmoothShader, setPipHue, setSmoothHue } from './pipMonochromeShader'
import { createProceduralDweller } from './proceduralDweller'
import { addRimLight } from './rimLight'
import type { DwellerRig } from './rig'

export const RENDER_W = 240
export const RENDER_H = 320
const FRAME_MS = 1000 / 30
const ORBIT = (15 * Math.PI) / 180
const BASE_YAW = (22 * Math.PI) / 180

export type EngineOptions = {
  hue: number
  vault: string
  animate: boolean
  pixelSize?: number
  /** Render profile for the DETAIL level. Defaults to RETRO (the original look). */
  profile?: DetailProfile
  /** EffectsConfig.glow (0-1); scales the bloom on smooth levels. */
  glow?: number
}

export type DwellerEngine = {
  setHue(hue: number): void
  setVault(vault: string): void
  setHeadshot(dataUrl: string | null): Promise<void>
  setRunning(running: boolean): void
  setGlow(glow: number): void
  /** Match the backing store to a CSS box (smooth levels only; RETRO stays 240×320). */
  resize(cssW: number, cssH: number, dpr: number): void
  readonly source: 'procedural' | 'glb'
  dispose(): void
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('headshot image failed to load'))
    img.src = src
  })

/** Build the scene into `canvas`. Tries the optional GLB, falls back to the procedural rig. */
export async function createDwellerEngine(canvas: HTMLCanvasElement, opts: EngineOptions): Promise<DwellerEngine> {
  const profile = opts.profile ?? detailProfile('RETRO')
  let rig: DwellerRig | null = null
  let source: DwellerEngine['source'] = 'procedural'
  if (await glbAvailable()) {
    try {
      rig = await createGlbDweller()
      source = 'glb'
    } catch (err) {
      console.warn('[dweller] GLB failed, using procedural figure', err)
    }
  }
  rig ??= createProceduralDweller(profile.geometry)
  return buildEngine(canvas, rig, source, { ...opts, profile })
}

/** Soft lit floor with a darker contact shadow under the feet (HI-FI). */
function makeFloor(): Mesh {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(0.28, 'rgba(0,0,0,0.92)')
    g.addColorStop(0.46, 'rgba(60,60,60,0.45)')
    g.addColorStop(0.7, 'rgba(90,90,90,0.18)')
    g.addColorStop(1, 'rgba(90,90,90,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const floor = new Mesh(new PlaneGeometry(1.15, 1.15), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
  floor.name = 'Floor'
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.001
  floor.scale.set(1, 1.25, 1) // a touch longer front-to-back, where the stride goes
  floor.renderOrder = -1
  return floor
}

function buildEngine(
  canvas: HTMLCanvasElement,
  rig: DwellerRig,
  source: DwellerEngine['source'],
  opts: EngineOptions & { profile: DetailProfile },
): DwellerEngine {
  const { profile } = opts
  const smooth = profile.smooth
  let width = RENDER_W
  let height = RENDER_H

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const camera = new PerspectiveCamera(30, width / height, 0.1, 20)
  const target = new Vector3(0, 0.9, 0)
  const DIST = 4.45

  if (profile.studioLights) {
    scene.add(new HemisphereLight(0xdfe8ff, 0x202020, 0.6))
    const key = new DirectionalLight(0xffffff, 2.6)
    key.position.set(2.2, 3.2, 2.6)
    const fill = new DirectionalLight(0xffffff, 0.8)
    fill.position.set(-2.8, 1.2, 2.2)
    const rimL = new DirectionalLight(0xffffff, 2.4)
    rimL.position.set(-1.8, 2.6, -3)
    const rimR = new DirectionalLight(0xffffff, 1.4)
    rimR.position.set(2.4, 1.6, -2.6)
    scene.add(key, fill, rimL, rimR)
  } else {
    scene.add(new HemisphereLight(0xdfe8ff, 0x303030, 1.4))
    scene.add(new AmbientLight(0xffffff, 0.25))
    const key = new DirectionalLight(0xffffff, 2.2)
    key.position.set(2, 3, 3)
    scene.add(key)
    const rim = new DirectionalLight(0xffffff, 1.2)
    rim.position.set(-2, 2, -3)
    scene.add(rim)
  }
  scene.add(rig.root)
  if (profile.rim > 0) {
    rig.root.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) addRimLight(m, profile.rim)
    })
  }
  if (profile.floor) scene.add(makeFloor())

  // Headshot billboard: a camera-facing plane parented to the head slot.
  // Smooth levels keep the feathered circular edge; RETRO cuts it hard like the rest.
  const billboardMat = new MeshBasicMaterial({ transparent: true, alphaTest: smooth ? 0.02 : 0.5, depthWrite: true })
  if (smooth) billboardMat.color.setScalar(0.82) // keep photo highlights under the bloom threshold
  const billboard = new Mesh(new PlaneGeometry(1, 1), billboardMat)
  billboard.name = 'HeadshotBillboard'
  billboard.visible = false
  rig.headSlot.add(billboard)

  const msaaTarget = smooth ? new WebGLRenderTarget(width, height, { type: HalfFloatType, samples: profile.msaa }) : undefined
  const composer = new EffectComposer(renderer, msaaTarget)
  composer.setPixelRatio(1)
  composer.setSize(width, height)
  composer.addPass(new RenderPass(scene, camera))

  let mono: ShaderPass
  let bloom: UnrealBloomPass | null = null
  if (smooth) {
    mono = new ShaderPass(PipSmoothShader)
    composer.addPass(mono)
    if (profile.bloom > 0) {
      bloom = new UnrealBloomPass(new Vector2(width, height), profile.bloom, 0.15, 0.7)
      composer.addPass(bloom)
    }
  } else {
    mono = new ShaderPass(PipMonochromeShader)
    mono.uniforms.resolution.value.set(RENDER_W, RENDER_H)
    mono.uniforms.pixelSize.value = opts.pixelSize ?? 1
    composer.addPass(mono)
  }
  composer.addPass(new OutputPass())

  const applyHue = (hue: number) =>
    smooth
      ? setSmoothHue(mono.uniforms as unknown as typeof PipSmoothShader.uniforms, hue)
      : setPipHue(mono.uniforms as typeof PipMonochromeShader.uniforms, hue)
  const applyGlow = (glow: number) => {
    if (!bloom) return
    bloom.strength = profile.bloom * (0.35 + 0.65 * Math.min(1, Math.max(0, glow)))
    bloom.enabled = glow > 0.01
  }
  const applySize = (pixelRatio: number) => {
    if (!smooth) return
    mono.uniforms.resolution.value.set(width, height)
    mono.uniforms.scanPeriod.value = scanPeriod(pixelRatio)
    mono.uniforms.outlinePx.value = 1.1 * pixelRatio
  }

  applyHue(opts.hue)
  applyGlow(opts.glow ?? 1)
  applySize(1)
  rig.setVault(opts.vault)

  const q = new Quaternion()
  const ws = new Vector3()
  let time = 0.35
  let raf = 0
  let last = 0
  let disposed = false
  const animate = opts.animate

  const draw = () => {
    if (disposed) return
    rig.update(time, Math.min(0.1, FRAME_MS / 1000))
    const yaw = BASE_YAW + (animate ? ORBIT * Math.sin(time * 0.35) : 0)
    camera.position.set(Math.sin(yaw) * DIST, 1.2, Math.cos(yaw) * DIST)
    camera.lookAt(target)
    scene.updateMatrixWorld()
    if (billboard.visible) {
      // Undo the parent's world rotation/scale so the plane faces the camera at a fixed size.
      rig.headSlot.getWorldQuaternion(q)
      billboard.quaternion.copy(q.invert()).multiply(camera.quaternion)
      rig.headSlot.getWorldScale(ws)
      billboard.scale.set(rig.headSize / ws.x, rig.headSize / ws.y, 1)
      billboard.updateMatrixWorld()
    }
    composer.render()
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    if (now - last < FRAME_MS - 2) return
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
    last = now
    time += dt
    draw()
  }

  const setRunning = (run: boolean) => {
    cancelAnimationFrame(raf)
    raf = 0
    last = 0
    if (run && animate && !disposed) raf = requestAnimationFrame(tick)
    else draw()
  }

  let headshotTex: Texture | null = null
  let headshotToken = 0

  draw()

  return {
    source,
    setHue(hue) {
      applyHue(hue)
      if (!raf) draw()
    },
    setGlow(glow) {
      applyGlow(glow)
      if (!raf) draw()
    },
    resize(cssW, cssH, dpr) {
      if (!smooth || disposed) return
      const s = renderSize(cssW, cssH, dpr, profile.maxDpr, profile.maxPixels)
      if (s.width === width && s.height === height) return
      width = s.width
      height = s.height
      renderer.setSize(width, height, false)
      composer.setSize(width, height)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      applySize(s.pixelRatio)
      if (!raf) draw()
    },
    setVault(vault) {
      rig.setVault(vault)
      if (!raf) draw()
    },
    async setHeadshot(dataUrl) {
      const token = ++headshotToken
      const img = dataUrl ? await loadImage(dataUrl).catch(() => null) : null
      if (disposed || token !== headshotToken) return
      headshotTex?.dispose()
      headshotTex = null
      if (img) {
        headshotTex = new Texture(img)
        headshotTex.colorSpace = SRGBColorSpace
        headshotTex.needsUpdate = true
      }
      billboardMat.map = headshotTex
      billboardMat.needsUpdate = true
      billboard.visible = !!headshotTex
      rig.setHeadVisible(!headshotTex)
      if (!raf) draw()
    },
    setRunning,
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      headshotTex?.dispose()
      scene.traverse((o) => {
        const mesh = o as Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mats: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          for (const m of mats) {
            for (const v of Object.values(m)) if (v instanceof Texture) v.dispose()
            m.dispose()
          }
        }
      })
      rig.dispose()
      ;(mono.uniforms.tRamp?.value as Texture | null | undefined)?.dispose()
      bloom?.dispose()
      composer.dispose()
      mono.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
