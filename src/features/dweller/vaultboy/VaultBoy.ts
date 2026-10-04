// Adapted from the user-supplied Vault Boy rig kit (src/VaultBoy.ts). Non-commercial fan use.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createPhosphor, applyGlass, DEFAULT_STYLE, type PhosphorStyle } from './phosphor';
import { POSES, BONE, AIM_CHILD, expandCurl, rotToEuler, type PoseDef, type Osc } from './poses';

const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

export interface LoadOptions { style?: Partial<PhosphorStyle>; height?: number; ring?: boolean }

/**
 * The whole public surface:
 *   const vb = await VaultBoy.load('/models/vaultboy.glb')
 *   scene.add(vb.object);  vb.update(dt) every frame
 *   vb.setColor('#ffb000')          // recolour everything (one value)
 *   vb.play('walkInPlace')          // looping clip      (idle | alert | walk | walkInPlace | run)
 *   vb.pose('thumbsUp')             // held pose, tweened (see POSES in poses.ts)
 */
export class VaultBoy {
  readonly object = new THREE.Group();
  readonly clips: string[];
  readonly bones = new Map<string, THREE.Bone>();       // by short name (see BONE map)
  private mesh!: THREE.SkinnedMesh;
  private wireMesh!: THREE.SkinnedMesh;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private current?: THREE.AnimationAction;
  private bind = new Map<THREE.Bone, THREE.Quaternion>();
  private bindPos = new Map<THREE.Bone, THREE.Vector3>();
  private blendIn?: { t: number; dur: number; from: Map<THREE.Bone, THREE.Quaternion> };
  private clock = 0;
  private osc: Record<string, Osc> = {};
  /** subtle chest breathing while a pose is held */
  breathe = true;
  private tween?: { t: number; dur: number; from: Map<THREE.Bone, THREE.Quaternion>; to: Map<THREE.Bone, THREE.Quaternion> };
  private mats: ReturnType<typeof createPhosphor>;
  private ringMat?: THREE.MeshBasicMaterial;
  style: PhosphorStyle;
  mode: 'clip' | 'pose' = 'clip';
  poseName = '';

  private constructor(gltf: GLTF, opts: LoadOptions) {
    this.style = { ...DEFAULT_STYLE, ...opts.style };
    this.mats = createPhosphor(this.style);

    const model: THREE.Object3D = gltf.scene;
    this.object.add(model);
    model.traverse((o) => {
      if ((o as THREE.SkinnedMesh).isSkinnedMesh) this.mesh = o as THREE.SkinnedMesh;
      if ((o as THREE.Bone).isBone) {
        const b = o as THREE.Bone;
        this.bind.set(b, b.quaternion.clone());
        this.bindPos.set(b, b.position.clone());
      }
    });
    for (const [short, full] of Object.entries(BONE)) {
      const b = model.getObjectByName(full) as THREE.Bone | undefined;
      if (b) this.bones.set(short, b);
    }

    // glass body + wireframe overlay share one skeleton
    this.mesh.material = this.mats.body;
    this.mesh.frustumCulled = false;
    this.wireMesh = new THREE.SkinnedMesh(this.mesh.geometry, this.mats.wire);
    this.wireMesh.bind(this.mesh.skeleton, this.mesh.bindMatrix);
    this.wireMesh.frustumCulled = false;
    this.mesh.parent!.add(this.wireMesh);
    this.wireMesh.visible = this.style.wire > 0;

    // normalise size: feet on y=0, `height` tall
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.mesh);
    const h = box.max.y - box.min.y;
    const s = (opts.height ?? 1.8) / h;
    this.object.scale.setScalar(s);
    this.object.position.y = -box.min.y * s;

    // ground ring (tinted with the character; pass { ring:false } to drop it)
    if (opts.ring !== false) {
      this.ringMat = new THREE.MeshBasicMaterial({ color: this.style.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.62 / s, 0.64 / s, 96), this.ringMat);
      ring.rotation.x = -Math.PI / 2; ring.position.y = box.min.y + 0.002 / s;
      this.object.add(ring);
    }

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.clips = [...this.actions.keys()];
  }

  static async load(url: string, opts: LoadOptions = {}) {
    const gltf = await new GLTFLoader().loadAsync(url);
    return new VaultBoy(gltf, opts);
  }

  // ---------- style ----------
  /** THE colour knob. Recolours body, wireframe and ground ring in one call. */
  setColor(c: THREE.ColorRepresentation) {
    this.style.color = c;
    this.mats.color.set(c);               // body shader uniform (shared object)
    this.mats.wire.color.set(c);          // MeshBasicMaterial copies colours, so set it explicitly
    this.ringMat?.color.set(c);
  }
  setStyle(p: Partial<PhosphorStyle>) {
    Object.assign(this.style, p);
    const u = this.mats.body.uniforms;
    if (p.color !== undefined) this.setColor(p.color);
    if (p.fill !== undefined) u.uFill.value = p.fill;
    if (p.rim !== undefined) u.uRim.value = p.rim;
    if (p.rimPower !== undefined) u.uRimPower.value = p.rimPower;
    if (p.lines !== undefined) u.uLines.value = p.lines;
    if (p.lineDensity !== undefined) u.uDensity.value = p.lineDensity;
    if (p.scan !== undefined) u.uScan.value = p.scan;
    if (p.glass !== undefined) applyGlass(this.mats.body, p.glass);
    if (p.wire !== undefined) { this.mats.wire.opacity = p.wire; this.wireMesh.visible = p.wire > 0; }
  }

  // ---------- clips ----------
  play(name: string, fade = 0.35) {
    const next = this.actions.get(name);
    if (!next) throw new Error(`unknown clip "${name}". have: ${this.clips.join(', ')}`);
    const wasPose = this.mode === 'pose';
    const from = wasPose ? this.snapshot() : undefined;
    if (wasPose) this.releasePose();
    if (from && fade > 0) this.blendIn = { t: 0, dur: fade, from };
    next.reset().setEffectiveWeight(1).play();
    if (this.current && this.current !== next) this.current.crossFadeTo(next, fade, false);
    this.current = next;
    this.mode = 'clip';
    this.poseName = '';
  }
  /** freeze a clip at time t (for screenshots / scrubbing) */
  sample(name: string, t: number) {
    this.play(name, 0);
    this.current!.paused = true;
    this.current!.time = t;
    this.mixer.update(0);
  }

  // ---------- poses ----------
  /** capture whatever the skeleton is doing right now */
  private snapshot() {
    const m = new Map<THREE.Bone, THREE.Quaternion>();
    for (const b of this.bind.keys()) m.set(b, b.quaternion.clone());
    return m;
  }
  private releasePose() { this.tween = undefined; }

  /**
   * Solve a PoseDef into target bone rotations (bind pose + rot/curl, then aim-solve limbs
   * parent-first so each segment points where the pose says). Leaves the skeleton untouched.
   */
  private solve(def: PoseDef): Map<THREE.Bone, THREE.Quaternion> {
    const saved = this.snapshot();
    for (const [b, q] of this.bind) b.quaternion.copy(q);

    const rots = rotToEuler({ ...expandCurl(def), ...(def.rot ?? {}) });
    for (const [name, e] of rots) {
      const b = this.bones.get(name);
      if (b) b.quaternion.multiply(new THREE.Quaternion().setFromEuler(e));
    }

    const depth = (b: THREE.Object3D) => { let d = 0; for (let o = b.parent; o; o = o.parent) d++; return d; };
    const frame = this.object.getWorldQuaternion(new THREE.Quaternion());
    const aims = Object.entries(def.aim ?? {})
      .map(([n, v]) => ({ n, v, b: this.bones.get(n), c: this.bones.get(AIM_CHILD[n] ?? '') }))
      .filter((a) => a.b && a.c)
      .sort((a, b) => depth(a.b!) - depth(b.b!));
    const P = new THREE.Vector3(), C = new THREE.Vector3();
    for (const { v, b, c } of aims) {
      b!.updateWorldMatrix(true, false); c!.updateWorldMatrix(true, false);
      b!.getWorldPosition(P); c!.getWorldPosition(C);
      const cur = C.sub(P).normalize();
      const tgt = new THREE.Vector3(...v).normalize().applyQuaternion(frame);
      const parentQ = b!.parent!.getWorldQuaternion(new THREE.Quaternion());
      const worldQ = parentQ.clone().multiply(b!.quaternion);
      const d = new THREE.Quaternion().setFromUnitVectors(cur, tgt);
      b!.quaternion.copy(parentQ.invert().multiply(d.multiply(worldQ)));
    }
    const to = this.snapshot();
    for (const [b, q] of saved) b.quaternion.copy(q);
    return to;
  }

  /** Tween to a named pose (or an inline PoseDef). Holds until play()/pose() is called again. */
  pose(p: string | PoseDef, ms = 450) {
    const def = typeof p === 'string' ? POSES[p] : p;
    if (!def) throw new Error(`unknown pose "${p}". have: ${Object.keys(POSES).join(', ')}`);
    const from = this.snapshot();
    this.mixer.stopAllAction();            // clips release the skeleton...
    this.current = undefined;
    for (const [b, q] of from) b.quaternion.copy(q);   // ...so restore what we captured
    const to = this.solve(def);
    this.tween = { t: 0, dur: Math.max(ms, 1) / 1000, from, to };
    this.osc = def.osc ?? {};
    this.mode = 'pose';
    this.poseName = typeof p === 'string' ? p : 'custom';
  }
  /** snap to a pose instantly (screenshots) */
  poseNow(p: string | PoseDef) { this.pose(p, 1); this.update(1); }

  update(dt: number) {
    this.clock += dt;
    if (this.mode === 'clip') {
      this.mixer.update(dt);
      const bi = this.blendIn;
      if (bi) {                                   // ease from the held pose into the clip
        bi.t = Math.min(bi.t + dt, bi.dur);
        const k = ease(bi.t / bi.dur);
        for (const [b, q] of bi.from) { const clipQ = b.quaternion.clone(); b.quaternion.copy(q).slerp(clipQ, k); }
        if (bi.t >= bi.dur) this.blendIn = undefined;
      }
    } else if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(tw.t + dt, tw.dur);
      const k = ease(tw.t / tw.dur);
      for (const [b, q] of tw.to) b.quaternion.copy(tw.from.get(b)!).slerp(q, k);
      for (const [name, o] of Object.entries(this.osc)) {           // looping wobble, faded in with the tween
        const b = this.bones.get(name); if (!b) continue;
        const a = THREE.MathUtils.degToRad(o.deg) * k * Math.sin((this.clock * o.hz + (o.phase ?? 0)) * Math.PI * 2);
        b.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(o.axis === 0 ? a : 0, o.axis === 1 ? a : 0, o.axis === 2 ? a : 0)));
      }
      if (this.breathe) {
        const chest = this.bones.get('spine2');
        if (chest) chest.quaternion.multiply(new THREE.Quaternion().setFromEuler(
          new THREE.Euler(THREE.MathUtils.degToRad(Math.sin(this.clock * 1.7) * 0.9), 0, 0)));
      }
    }
  }

  // ---------- conveniences ----------
  /** go to the central stance */
  stand(ms = 450) { this.pose('neutral', ms); }
  /** Free GPU resources (geometry, materials, ring) and stop the mixer. */
  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
    this.object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry?.dispose();
    });
    this.mats.body.dispose();
    this.mats.wire.dispose();
    this.ringMat?.dispose();
  }

  /** stance -> gesture -> hold -> back to stance. Resolves when finished. */
  async gesture(name: string, { hold = 1200, ms = 450 } = {}) {
    const wait = (t: number) => new Promise((r) => setTimeout(r, t));
    this.pose(name, ms); await wait(ms + hold);
    this.stand(ms); await wait(ms);
  }
}
