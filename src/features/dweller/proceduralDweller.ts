import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Skeleton,
  SphereGeometry,
  TorusGeometry,
  Bone,
  type Material,
} from 'three'
import type { DwellerRig } from './rig'
import { VaultDecal } from './vaultDecal'

/**
 * A low-poly Vault Dweller built from primitives, parented to a real named skeleton,
 * with a code-driven walk cycle in place. 100% original geometry.
 */
export function createProceduralDweller(): DwellerRig {
  const lambert = (color: number) => new MeshLambertMaterial({ color, flatShading: true })
  const mat = {
    suit: lambert(0x2f63b8),
    suitDark: lambert(0x22488a),
    trim: lambert(0xf2c230),
    skin: lambert(0xd9a882),
    hair: lambert(0x3b2a1e),
    boot: lambert(0x2b2b30),
    glove: lambert(0x45454c),
  }

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

  // ---- torso ----
  part(new CylinderGeometry(0.16, 0.17, 0.2, 8), mat.suit, hips, 0, 0, 0, 1, 1, 0.72) // pelvis
  part(new CylinderGeometry(0.173, 0.173, 0.05, 8), mat.trim, hips, 0, 0.09, 0, 1, 1, 0.74) // belt
  part(new BoxGeometry(0.07, 0.045, 0.03), mat.trim, hips, 0, 0.09, 0.125) // buckle
  part(new CylinderGeometry(0.165, 0.16, 0.2, 8), mat.suit, spine, 0, 0.1, 0, 1, 1, 0.7) // abdomen
  part(new CylinderGeometry(0.205, 0.165, 0.28, 8), mat.suit, chest, 0, 0.13, 0, 1, 1, 0.66) // ribcage
  part(new SphereGeometry(0.08, 8, 6), mat.suit, chest, 0.2, 0.22, 0) // shoulders
  part(new SphereGeometry(0.08, 8, 6), mat.suit, chest, -0.2, 0.22, 0)
  // front zip stripe from collar to belt
  const stripe = part(new BoxGeometry(0.04, 0.29, 0.02), mat.trim, chest, 0, 0.12, 0.118)
  stripe.rotation.x = -0.09
  part(new BoxGeometry(0.04, 0.2, 0.02), mat.trim, spine, 0, 0.1, 0.112)
  // shoulder yoke seam
  part(new TorusGeometry(0.15, 0.012, 4, 12, Math.PI), mat.trim, chest, 0, 0.25, 0.02, 1, 0.45, 0.8).rotation.set(-Math.PI / 2, 0, Math.PI)

  // vault number: big on the back, small patch on the chest
  const backDecal = new VaultDecal(false)
  const chestDecal = new VaultDecal(true, 96, 72)
  const decalMat = (d: VaultDecal) => new MeshBasicMaterial({ map: d.texture, transparent: true, alphaTest: 0.5, depthWrite: true })
  const back = part(new PlaneGeometry(0.24, 0.18), decalMat(backDecal), chest, 0, 0.15, -0.128)
  back.rotation.set(-0.06, Math.PI, 0)
  const patch = part(new PlaneGeometry(0.09, 0.068), decalMat(chestDecal), chest, 0.085, 0.19, 0.128)
  patch.rotation.x = -0.12

  // ---- neck + head ----
  part(new TorusGeometry(0.075, 0.026, 5, 10), mat.trim, neck, 0, 0.0, 0).rotation.x = Math.PI / 2 // collar
  part(new CylinderGeometry(0.052, 0.058, 0.1, 8), mat.skin, neck, 0, 0.03, 0)
  const headGroup = new Group()
  headGroup.name = 'HeadMesh'
  head.add(headGroup)
  part(new SphereGeometry(0.112, 10, 8), mat.skin, headGroup, 0, 0.1, 0.005, 0.92, 1.1, 1)
  part(new SphereGeometry(0.118, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), mat.hair, headGroup, 0, 0.125, -0.018, 0.95, 1.05, 1.02).rotation.x = -0.55
  part(new SphereGeometry(0.024, 6, 4), mat.skin, headGroup, 0.1, 0.09, 0) // ears
  part(new SphereGeometry(0.024, 6, 4), mat.skin, headGroup, -0.1, 0.09, 0)
  part(new BoxGeometry(0.026, 0.04, 0.03), mat.skin, headGroup, 0, 0.085, 0.112) // nose
  part(new BoxGeometry(0.025, 0.014, 0.01), mat.hair, headGroup, 0.04, 0.115, 0.103) // eyes
  part(new BoxGeometry(0.025, 0.014, 0.01), mat.hair, headGroup, -0.04, 0.115, 0.103)
  const headSlot = new Object3D()
  headSlot.name = 'HeadSlot'
  headSlot.position.set(0, 0.1, 0.02)
  head.add(headSlot)

  // ---- arms ----
  for (const side of ['L', 'R'] as const) {
    part(new CapsuleGeometry(0.056, 0.18, 2, 8), mat.suit, upperArm[side], 0, -0.13, 0)
    part(new CapsuleGeometry(0.048, 0.16, 2, 8), mat.suit, lowerArm[side], 0, -0.12, 0)
    part(new CylinderGeometry(0.054, 0.054, 0.035, 8), mat.trim, lowerArm[side], 0, -0.22, 0) // cuff
    part(new SphereGeometry(0.054, 8, 6), mat.glove, lowerArm[side], 0, -0.28, 0.005, 0.8, 1.15, 0.95) // glove
  }

  // ---- legs ----
  for (const side of ['L', 'R'] as const) {
    part(new CapsuleGeometry(0.078, 0.27, 2, 8), mat.suit, upperLeg[side], 0, -0.21, 0)
    part(new CapsuleGeometry(0.064, 0.27, 2, 8), mat.suit, lowerLeg[side], 0, -0.2, 0)
    part(new CylinderGeometry(0.072, 0.066, 0.14, 8), mat.boot, foot[side], 0, 0.03, 0) // boot shaft
    part(new BoxGeometry(0.11, 0.08, 0.25), mat.boot, foot[side], 0, -0.05, 0.045) // boot
    part(new CylinderGeometry(0.075, 0.075, 0.03, 8), mat.trim, foot[side], 0, 0.1, 0) // boot cuff
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
    },
  }
}
