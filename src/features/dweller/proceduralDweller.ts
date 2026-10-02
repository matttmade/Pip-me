import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Skeleton,
  SphereGeometry,
  TorusGeometry,
  Bone,
  Vector2,
  type Material,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Geometry } from './fidelity'
import type { DwellerRig } from './rig'
import { VaultDecal } from './vaultDecal'

const COLORS = {
  suit: 0x2f63b8,
  suitDark: 0x22488a,
  trim: 0xf2c230,
  skin: 0xd9a882,
  hair: 0x3b2a1e,
  boot: 0x2b2b30,
  glove: 0x45454c,
  sole: 0x18181c,
  lip: 0xa86e5a,
}
type MatName = keyof typeof COLORS

/** A capsule whose two ends can differ in radius (thigh → knee, etc.), as a smooth lathe. */
function taperedCapsule(r0: number, r1: number, len: number, radial = 28, cap = 7): LatheGeometry {
  const pts: Vector2[] = []
  for (let i = 0; i <= cap; i++) {
    const a = -Math.PI / 2 + (i / cap) * (Math.PI / 2)
    pts.push(new Vector2(r1 * Math.cos(a), -len / 2 + r1 * Math.sin(a)))
  }
  for (let i = 0; i <= cap; i++) {
    const a = (i / cap) * (Math.PI / 2)
    pts.push(new Vector2(r0 * Math.cos(a), len / 2 + r0 * Math.sin(a)))
  }
  return new LatheGeometry(pts, radial)
}

const profile = (pts: [number, number][], grow = 1) => pts.map(([r, y]) => new Vector2(r * grow, y))

// Lathe profiles (radius, height) for the HI-FI torso. Scaled flat in Z after lathing.
const PELVIS: [number, number][] = [[0, -0.13], [0.09, -0.128], [0.14, -0.1], [0.163, -0.04], [0.168, 0.04], [0.164, 0.11], [0, 0.11]]
const ABDOMEN: [number, number][] = [[0, -0.01], [0.16, -0.01], [0.161, 0.08], [0.162, 0.21], [0, 0.21]]
const RIBCAGE: [number, number][] = [
  [0, -0.03], [0.166, -0.03], [0.18, 0.04], [0.196, 0.12], [0.203, 0.19], [0.196, 0.24], [0.165, 0.275], [0.11, 0.3], [0.06, 0.308], [0, 0.308],
]

/**
 * A Vault Dweller built from primitives, parented to a real named skeleton, with a
 * code-driven walk cycle in place. 100% original geometry.
 * - 'low'  : the original faceted, low-poly figure (RETRO).
 * - 'mid'  : same shapes, smooth-shaded with ~3× the segments (CLEAN).
 * - 'high' : sculpted lathe torso, tapered limbs, hands, boots with soles, collar, buckle (HI-FI).
 */
export function createProceduralDweller(quality: Geometry = 'low'): DwellerRig {
  const smoothShade = quality !== 'low'
  const S = (n: number) => (quality === 'low' ? n : Math.round(n * 3))
  const make = (name: MatName): Material => {
    if (quality === 'high') {
      const rough = name === 'trim' ? 0.42 : name === 'boot' || name === 'sole' ? 0.5 : name === 'skin' ? 0.62 : 0.72
      return new MeshStandardMaterial({ color: COLORS[name], roughness: rough, metalness: 0 })
    }
    return new MeshLambertMaterial({ color: COLORS[name], flatShading: !smoothShade })
  }
  const mat = Object.fromEntries((Object.keys(COLORS) as MatName[]).map((k) => [k, make(k)])) as Record<MatName, Material>

  const root = new Group()
  root.name = 'Dweller'

  const bones: Bone[] = []
  const bone = (name: string, parent: Object3D, x: number, y: number, z = 0) => {
    const b = new Bone()
    b.name = name
    b.position.set(x, y, z)
    parent.add(b)
    bones.push(b)
    return b
  }
  const part = (geo: BufferGeometry, m: Material, parent: Object3D, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new Mesh(geo, m)
    mesh.position.set(x, y, z)
    mesh.scale.set(sx, sy, sz)
    parent.add(mesh)
    return mesh
  }

  // ---- skeleton (metres, figure faces +Z) ----
  const hips = bone('Hips', root, 0, 0.98)
  const spine = bone('Spine', hips, 0, 0.1)
  const chest = bone('Chest', spine, 0, 0.2)
  const neck = bone('Neck', chest, 0, 0.27)
  const head = bone('Head', neck, 0, 0.07)
  const upperArm = { L: bone('UpperArm.L', chest, 0.215, 0.21), R: bone('UpperArm.R', chest, -0.215, 0.21) }
  const lowerArm = { L: bone('LowerArm.L', upperArm.L, 0, -0.28), R: bone('LowerArm.R', upperArm.R, 0, -0.28) }
  const upperLeg = { L: bone('UpperLeg.L', hips, 0.095, -0.04), R: bone('UpperLeg.R', hips, -0.095, -0.04) }
  const lowerLeg = { L: bone('LowerLeg.L', upperLeg.L, 0, -0.42), R: bone('LowerLeg.R', upperLeg.R, 0, -0.42) }
  const foot = { L: bone('Foot.L', lowerLeg.L, 0, -0.42), R: bone('Foot.R', lowerLeg.R, 0, -0.42) }
  const skeleton = new Skeleton(bones)

  // vault number: big on the back, small patch on the chest
  const backDecal = new VaultDecal(false)
  const chestDecal = new VaultDecal(true, 96, 72)
  const decalMat = (d: VaultDecal) => new MeshBasicMaterial({ map: d.texture, transparent: true, alphaTest: 0.5, depthWrite: true })

  const headGroup = new Group()
  headGroup.name = 'HeadMesh'
  head.add(headGroup)
  const headSlot = new Object3D()
  headSlot.name = 'HeadSlot'
  headSlot.position.set(0, 0.1, 0.02)
  head.add(headSlot)

  if (quality === 'high') {
    // ---- torso: lathed, flattened front-to-back ----
    const FLAT = 0.7
    part(new LatheGeometry(profile(PELVIS), 48), mat.suit, hips, 0, 0, 0, 1, 1, 0.72)
    part(new CylinderGeometry(0.174, 0.174, 0.052, 48), mat.trim, hips, 0, 0.09, 0, 1, 1, 0.74) // belt
    part(new RoundedBoxGeometry(0.078, 0.054, 0.022, 3, 0.008), mat.trim, hips, 0, 0.09, 0.131) // buckle
    part(new RoundedBoxGeometry(0.046, 0.026, 0.01, 2, 0.004), mat.suitDark, hips, 0, 0.09, 0.142) // buckle plate
    part(new LatheGeometry(profile(ABDOMEN), 48), mat.suit, spine, 0, 0, 0, 1, 1, FLAT)
    part(new LatheGeometry(profile(RIBCAGE), 48), mat.suit, chest, 0, 0, 0, 1, 1, 0.66)
    // front zip stripe: a thin wedge of the same profiles, so it hugs the body
    part(new LatheGeometry(profile(RIBCAGE.slice(1, 7), 1.025), 4, -0.1, 0.2), mat.trim, chest, 0, 0, 0, 1, 1, 0.66)
    part(new LatheGeometry(profile(ABDOMEN.slice(1, 4), 1.03), 4, -0.1, 0.2), mat.trim, spine, 0, 0, 0, 1, 1, FLAT)
    // shoulder yoke seam
    part(new TorusGeometry(0.15, 0.011, 10, 40, Math.PI), mat.trim, chest, 0, 0.255, 0.02, 1, 0.45, 0.8).rotation.set(-Math.PI / 2, 0, Math.PI)
    for (const x of [0.2, -0.2]) part(new SphereGeometry(0.086, 32, 20), mat.suit, chest, x, 0.215, 0, 1, 1, 0.95) // deltoids
    const back = part(new PlaneGeometry(0.24, 0.18), decalMat(backDecal), chest, 0, 0.15, -0.137)
    back.rotation.set(-0.04, Math.PI, 0)
    const patch = part(new PlaneGeometry(0.085, 0.064), decalMat(chestDecal), chest, 0.088, 0.19, 0.127)
    patch.rotation.set(-0.12, 0.3, 0)

    // ---- collar + neck ----
    part(new TorusGeometry(0.078, 0.022, 16, 40), mat.trim, neck, 0, 0.0, 0).rotation.x = Math.PI / 2
    for (const s of [1, -1]) {
      const tab = part(new RoundedBoxGeometry(0.052, 0.034, 0.012, 2, 0.005), mat.trim, neck, 0.036 * s, -0.012, 0.074)
      tab.rotation.set(-0.5, 0, 0.55 * s)
    }
    part(new CylinderGeometry(0.05, 0.058, 0.1, 24), mat.skin, neck, 0, 0.03, 0)

    // ---- head ----
    part(new SphereGeometry(0.112, 40, 28), mat.skin, headGroup, 0, 0.1, 0.005, 0.92, 1.1, 1)
    part(new SphereGeometry(0.088, 32, 20), mat.skin, headGroup, 0, 0.055, 0.022, 0.92, 0.78, 0.95) // jaw
    part(new SphereGeometry(0.119, 40, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), mat.hair, headGroup, 0, 0.125, -0.018, 0.95, 1.05, 1.02).rotation.x = -0.55
    part(new SphereGeometry(0.06, 24, 14), mat.hair, headGroup, 0.012, 0.198, 0.05, 1.45, 0.55, 1.05).rotation.z = -0.12 // quiff
    for (const s of [1, -1]) {
      part(new SphereGeometry(0.026, 16, 12), mat.skin, headGroup, 0.101 * s, 0.09, 0, 0.5, 1, 0.8) // ear
      part(new SphereGeometry(0.0115, 12, 8), mat.hair, headGroup, 0.039 * s, 0.112, 0.1) // eye
      part(new RoundedBoxGeometry(0.036, 0.008, 0.01, 2, 0.003), mat.hair, headGroup, 0.04 * s, 0.135, 0.1).rotation.z = -0.12 * s // brow
    }
    part(new SphereGeometry(0.018, 16, 12), mat.skin, headGroup, 0, 0.083, 0.113, 0.9, 1.3, 1.1) // nose
    part(new RoundedBoxGeometry(0.036, 0.007, 0.008, 2, 0.003), mat.lip, headGroup, 0, 0.048, 0.104) // mouth

    // ---- arms ----
    for (const side of ['L', 'R'] as const) {
      const inward = side === 'L' ? -1 : 1
      part(taperedCapsule(0.06, 0.05, 0.19), mat.suit, upperArm[side], 0, -0.13, 0)
      part(taperedCapsule(0.05, 0.042, 0.16), mat.suit, lowerArm[side], 0, -0.12, 0)
      part(new TorusGeometry(0.046, 0.012, 10, 32), mat.trim, lowerArm[side], 0, -0.212, 0).rotation.x = Math.PI / 2 // cuff
      part(new SphereGeometry(0.046, 24, 16), mat.glove, lowerArm[side], 0, -0.268, 0.004, 0.62, 1, 0.9) // palm
      const fingers = part(new CapsuleGeometry(0.021, 0.04, 4, 14), mat.glove, lowerArm[side], 0, -0.318, 0.012, 0.85, 1, 1.75)
      fingers.rotation.x = 0.22
      const thumb = part(new CapsuleGeometry(0.014, 0.03, 4, 12), mat.glove, lowerArm[side], 0.012 * inward, -0.268, 0.04)
      thumb.rotation.set(0.7, 0, 0.3 * inward)
    }

    // ---- legs + boots ----
    for (const side of ['L', 'R'] as const) {
      part(taperedCapsule(0.088, 0.07, 0.28), mat.suit, upperLeg[side], 0, -0.21, 0)
      part(taperedCapsule(0.068, 0.056, 0.27), mat.suit, lowerLeg[side], 0, -0.2, 0)
      part(new CylinderGeometry(0.072, 0.066, 0.16, 32), mat.boot, foot[side], 0, 0.03, 0) // shaft
      part(new TorusGeometry(0.072, 0.013, 10, 32), mat.trim, foot[side], 0, 0.105, 0).rotation.x = Math.PI / 2 // boot cuff
      part(new RoundedBoxGeometry(0.112, 0.085, 0.25, 4, 0.036), mat.boot, foot[side], 0, -0.05, 0.045) // foot
      part(new RoundedBoxGeometry(0.122, 0.024, 0.268, 2, 0.01), mat.sole, foot[side], 0, -0.094, 0.045) // sole
      part(new RoundedBoxGeometry(0.118, 0.016, 0.05, 2, 0.006), mat.glove, foot[side], 0, -0.012, 0.075) // strap
    }
  } else {
    // ---- torso ----
    part(new CylinderGeometry(0.16, 0.17, 0.2, S(8)), mat.suit, hips, 0, 0, 0, 1, 1, 0.72) // pelvis
    part(new CylinderGeometry(0.173, 0.173, 0.05, S(8)), mat.trim, hips, 0, 0.09, 0, 1, 1, 0.74) // belt
    part(new BoxGeometry(0.07, 0.045, 0.03), mat.trim, hips, 0, 0.09, 0.125) // buckle
    part(new CylinderGeometry(0.165, 0.16, 0.2, S(8)), mat.suit, spine, 0, 0.1, 0, 1, 1, 0.7) // abdomen
    part(new CylinderGeometry(0.205, 0.165, 0.28, S(8)), mat.suit, chest, 0, 0.13, 0, 1, 1, 0.66) // ribcage
    part(new SphereGeometry(0.08, S(8), S(6)), mat.suit, chest, 0.2, 0.22, 0) // shoulders
    part(new SphereGeometry(0.08, S(8), S(6)), mat.suit, chest, -0.2, 0.22, 0)
    // front zip stripe from collar to belt
    const stripe = part(new BoxGeometry(0.04, 0.29, 0.02), mat.trim, chest, 0, 0.12, 0.118)
    stripe.rotation.x = -0.09
    part(new BoxGeometry(0.04, 0.2, 0.02), mat.trim, spine, 0, 0.1, 0.112)
    // shoulder yoke seam
    part(new TorusGeometry(0.15, 0.012, S(4), S(12), Math.PI), mat.trim, chest, 0, 0.25, 0.02, 1, 0.45, 0.8).rotation.set(-Math.PI / 2, 0, Math.PI)

    const back = part(new PlaneGeometry(0.24, 0.18), decalMat(backDecal), chest, 0, 0.15, -0.128)
    back.rotation.set(-0.06, Math.PI, 0)
    const patch = part(new PlaneGeometry(0.09, 0.068), decalMat(chestDecal), chest, 0.085, 0.19, 0.128)
    patch.rotation.x = -0.12

    // ---- neck + head ----
    part(new TorusGeometry(0.075, 0.026, S(5), S(10)), mat.trim, neck, 0, 0.0, 0).rotation.x = Math.PI / 2 // collar
    part(new CylinderGeometry(0.052, 0.058, 0.1, S(8)), mat.skin, neck, 0, 0.03, 0)
    part(new SphereGeometry(0.112, S(10), S(8)), mat.skin, headGroup, 0, 0.1, 0.005, 0.92, 1.1, 1)
    part(new SphereGeometry(0.118, S(10), S(6), 0, Math.PI * 2, 0, Math.PI * 0.5), mat.hair, headGroup, 0, 0.125, -0.018, 0.95, 1.05, 1.02).rotation.x = -0.55
    part(new SphereGeometry(0.024, S(6), S(4)), mat.skin, headGroup, 0.1, 0.09, 0) // ears
    part(new SphereGeometry(0.024, S(6), S(4)), mat.skin, headGroup, -0.1, 0.09, 0)
    part(new BoxGeometry(0.026, 0.04, 0.03), mat.skin, headGroup, 0, 0.085, 0.112) // nose
    part(new BoxGeometry(0.025, 0.014, 0.01), mat.hair, headGroup, 0.04, 0.115, 0.103) // eyes
    part(new BoxGeometry(0.025, 0.014, 0.01), mat.hair, headGroup, -0.04, 0.115, 0.103)

    // ---- arms ----
    for (const side of ['L', 'R'] as const) {
      part(new CapsuleGeometry(0.056, 0.18, S(2), S(8)), mat.suit, upperArm[side], 0, -0.13, 0)
      part(new CapsuleGeometry(0.048, 0.16, S(2), S(8)), mat.suit, lowerArm[side], 0, -0.12, 0)
      part(new CylinderGeometry(0.054, 0.054, 0.035, S(8)), mat.trim, lowerArm[side], 0, -0.22, 0) // cuff
      part(new SphereGeometry(0.054, S(8), S(6)), mat.glove, lowerArm[side], 0, -0.28, 0.005, 0.8, 1.15, 0.95) // glove
    }

    // ---- legs ----
    for (const side of ['L', 'R'] as const) {
      part(new CapsuleGeometry(0.078, 0.27, S(2), S(8)), mat.suit, upperLeg[side], 0, -0.21, 0)
      part(new CapsuleGeometry(0.064, 0.27, S(2), S(8)), mat.suit, lowerLeg[side], 0, -0.2, 0)
      part(new CylinderGeometry(0.072, 0.066, 0.14, S(8)), mat.boot, foot[side], 0, 0.03, 0) // boot shaft
      part(new BoxGeometry(0.11, 0.08, 0.25), mat.boot, foot[side], 0, -0.05, 0.045) // boot
      part(new CylinderGeometry(0.075, 0.075, 0.03, S(8)), mat.trim, foot[side], 0, 0.1, 0) // boot cuff
    }
  }

  // ---- walk cycle ----
  const STRIDE_HZ = 0.85
  const update = (t: number) => {
    const p = t * Math.PI * 2 * STRIDE_HZ
    const s = Math.sin(p)
    const c = Math.cos(p)
    hips.position.y = 0.975 + 0.022 * Math.cos(2 * p)
    hips.position.x = 0.012 * c
    hips.rotation.set(0, 0.13 * s, 0.035 * s)
    spine.rotation.set(0.05, -0.06 * s, -0.02 * s)
    chest.rotation.set(0.02, -0.14 * s, -0.015 * s)
    neck.rotation.set(-0.03, 0.07 * s, 0.02 * s)
    head.rotation.set(-0.04, 0.02 * s, 0)

    const legL = -0.44 * s
    const legR = 0.44 * s
    const kneeL = 0.1 + 0.85 * Math.max(0, c) ** 2
    const kneeR = 0.1 + 0.85 * Math.max(0, -c) ** 2
    upperLeg.L.rotation.set(legL, 0, 0.02)
    upperLeg.R.rotation.set(legR, 0, -0.02)
    lowerLeg.L.rotation.x = kneeL
    lowerLeg.R.rotation.x = kneeR
    foot.L.rotation.x = -(legL + kneeL) * 0.75
    foot.R.rotation.x = -(legR + kneeR) * 0.75

    upperArm.L.rotation.set(0.38 * s, 0, 0.1)
    upperArm.R.rotation.set(-0.38 * s, 0, -0.1)
    lowerArm.L.rotation.x = -(0.28 + 0.4 * Math.max(0, -s))
    lowerArm.R.rotation.x = -(0.28 + 0.4 * Math.max(0, s))
  }
  update(0.3)

  return {
    root,
    head,
    headSlot,
    headSize: 0.32,
    setHeadVisible: (v) => void (headGroup.visible = v),
    setVault: (vault) => {
      backDecal.draw(vault)
      chestDecal.draw(vault)
    },
    update: (t) => update(t),
    dispose: () => {
      backDecal.dispose()
      chestDecal.dispose()
      skeleton.dispose()
      for (const m of Object.values(mat)) m.dispose() // includes any the chosen quality never used
    },
  }
}
