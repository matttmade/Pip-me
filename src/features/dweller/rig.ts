import type { Object3D } from 'three'

/** What the scene needs from either Dweller source (procedural or GLB). */
export type DwellerRig = {
  root: Object3D
  /** The Head bone (both paths guarantee one). */
  head: Object3D
  /** Where the headshot billboard is parented; follows the head. */
  headSlot: Object3D
  /** World-space diameter of the billboard that replaces the head. */
  headSize: number
  setHeadVisible(visible: boolean): void
  setVault(vault: string): void
  /** Advance the walk. `t` = seconds since start, `dt` = seconds since last frame. */
  update(t: number, dt: number): void
  dispose(): void
}
