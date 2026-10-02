import {
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { createGlbDweller, glbAvailable } from './glbDweller'
import { PipMonochromeShader, setPipHue } from './pipMonochromeShader'
import { createProceduralDweller } from './proceduralDweller'
import type { DwellerRig } from './rig'

export const RENDER_W = 240
export const RENDER_H = 320
const FRAME_MS = 1000 / 30
const ORBIT = (15 * Math.PI) / 180
const BASE_YAW = (22 * Math.PI) / 180

export type EngineOptions = { hue: number; vault: string; animate: boolean; pixelSize?: number }

export type DwellerEngine = {
  setHue(hue: number): void
  setVault(vault: string): void
  setHeadshot(dataUrl: string | null): Promise<void>
  setRunning(running: boolean): void
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
  rig ??= createProceduralDweller()
  return buildEngine(canvas, rig, source, opts)
}

function buildEngine(canvas: HTMLCanvasElement, rig: DwellerRig, source: DwellerEngine['source'], opts: EngineOptions): DwellerEngine {
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: false })
  renderer.setPixelRatio(1)
  renderer.setSize(RENDER_W, RENDER_H, false)
  renderer.setClearColor(0x000000, 0)

  const scene = new Scene()
  const camera = new PerspectiveCamera(30, RENDER_W / RENDER_H, 0.1, 20)
  const target = new Vector3(0, 0.9, 0)
  const DIST = 4.45

  scene.add(new HemisphereLight(0xdfe8ff, 0x303030, 1.4))
  scene.add(new AmbientLight(0xffffff, 0.25))
  const key = new DirectionalLight(0xffffff, 2.2)
  key.position.set(2, 3, 3)
  scene.add(key)
  const rim = new DirectionalLight(0xffffff, 1.2)
  rim.position.set(-2, 2, -3)
  scene.add(rim)
  scene.add(rig.root)

  // Headshot billboard: a camera-facing plane parented to the head slot.
  const billboardMat = new MeshBasicMaterial({ transparent: true, alphaTest: 0.5, depthWrite: true })
  const billboard = new Mesh(new PlaneGeometry(1, 1), billboardMat)
  billboard.name = 'HeadshotBillboard'
  billboard.visible = false
  rig.headSlot.add(billboard)

  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(1)
  composer.setSize(RENDER_W, RENDER_H)
  composer.addPass(new RenderPass(scene, camera))
  const mono = new ShaderPass(PipMonochromeShader)
  mono.uniforms.resolution.value.set(RENDER_W, RENDER_H)
  mono.uniforms.pixelSize.value = opts.pixelSize ?? 1
  composer.addPass(mono)
  composer.addPass(new OutputPass())

  setPipHue(mono.uniforms as typeof PipMonochromeShader.uniforms, opts.hue)
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
      setPipHue(mono.uniforms as typeof PipMonochromeShader.uniforms, hue)
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
      composer.dispose()
      mono.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
