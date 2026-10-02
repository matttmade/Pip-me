import { AnimationMixer, Box3, LoopRepeat, Object3D, Vector3, type AnimationClip, type KeyframeTrack } from 'three'
import type { DwellerRig } from './rig'

export const GLB_URL = '/models/dweller.glb'

/** True when an actual GLB is served (SPA fallbacks answer 200 with HTML, so check the type). */
export async function glbAvailable(url = GLB_URL): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    return res.ok && !/text\/html/i.test(res.headers.get('content-type') ?? '')
  } catch {
    return false
  }
}

/** Remove horizontal root motion from the Hips position track so the walk stays in place. */
function stripRootMotion(clip: AnimationClip): void {
  const track = clip.tracks.find((t: KeyframeTrack) => /hips.*\.position$/i.test(t.name))
  if (!track) return
  const v = track.values
  const x0 = v[0]
  const z0 = v[2]
  for (let i = 0; i < v.length; i += 3) {
    v[i] = x0
    v[i + 2] = z0
  }
}

/** Load the optional openly licensed model (public/models/dweller.glb). */
export async function createGlbDweller(url = GLB_URL): Promise<DwellerRig> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const gltf = await new GLTFLoader().loadAsync(url)
  const model = gltf.scene

  // Normalise to ~1.75m tall, feet on y=0, centred.
  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  const scale = size.y > 0 ? 1.75 / size.y : 1
  model.scale.setScalar(scale)
  box.setFromObject(model)
  const centre = box.getCenter(new Vector3())
  model.position.x -= centre.x
  model.position.z -= centre.z
  model.position.y -= box.min.y

  let head: Object3D | undefined
  model.traverse((o) => {
    if (!head && (o as { isBone?: boolean }).isBone && /head/i.test(o.name) && !/top|end/i.test(o.name)) head = o
  })
  if (!head) throw new Error('GLB has no Head bone')
  const headBone = head

  const mixer = new AnimationMixer(model)
  const clip = gltf.animations.find((a) => /walk/i.test(a.name)) ?? gltf.animations[0]
  if (clip) {
    stripRootMotion(clip)
    mixer.clipAction(clip).setLoop(LoopRepeat, Infinity).play()
  }

  // The slot is a sibling of the head bone, so the bone can be collapsed to hide the head.
  const headSlot = new Object3D()
  headSlot.name = 'HeadSlot'
  headBone.parent?.add(headSlot)
  const slotOffset = new Vector3(0, 0.1 / scale, 0)
  const headScale = headBone.scale.clone()

  return {
    root: model,
    head: headBone,
    headSlot,
    headSize: 0.3,
    setHeadVisible: (v) => void (v ? headBone.scale.copy(headScale) : headBone.scale.setScalar(1e-3)),
    setVault: () => {},
    update: (_t, dt) => {
      mixer.update(dt)
      headSlot.position.copy(headBone.position).add(slotOffset)
    },
    dispose: () => mixer.stopAllAction(),
  }
}
