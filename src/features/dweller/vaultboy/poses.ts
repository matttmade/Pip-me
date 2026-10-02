// From the user-supplied Vault Boy rig kit. Non-commercial fan use.
import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * BONE NAMES
 * short name -> bone name AS THREE.JS SEES IT.
 * The GLB says "mixamorig:Hips" but GLTFLoader strips ':' -> "mixamorigHips".
 * ------------------------------------------------------------------ */
const M = 'mixamorig';
const side = (s: 'L' | 'R', long: 'Left' | 'Right') => ({
  [`shoulder${s}`]: `${M}${long}Shoulder`, [`arm${s}`]: `${M}${long}Arm`,
  [`foreArm${s}`]: `${M}${long}ForeArm`, [`hand${s}`]: `${M}${long}Hand`,
  [`upLeg${s}`]: `${M}${long}UpLeg`, [`leg${s}`]: `${M}${long}Leg`,
  [`foot${s}`]: `${M}${long}Foot`, [`toe${s}`]: `${M}${long}ToeBase`,
  ...Object.fromEntries(['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'].flatMap((f) =>
    [1, 2, 3].map((i) => [`${f.toLowerCase()}${i}${s}`, `${M}${long}Hand${f}${i}`]))),
});
export const BONE: Record<string, string> = {
  hips: `${M}Hips`, spine: `${M}Spine`, spine1: `${M}Spine1`, spine2: `${M}Spine2`,
  neck: `${M}Neck`, head: `${M}Head`,
  ...side('L', 'Left'), ...side('R', 'Right'),
};

/** Which bone each "aim" bone points at (used by the solver). */
export const AIM_CHILD: Record<string, string> = {
  armL: 'foreArmL', foreArmL: 'handL', handL: 'middle1L',
  armR: 'foreArmR', foreArmR: 'handR', handR: 'middle1R',
  upLegL: 'legL', legL: 'footL', footL: 'toeL',
  upLegR: 'legR', legR: 'footR', footR: 'toeR',
};

/* ------------------------------------------------------------------ *
 * POSE SCHEMA
 *
 * CHARACTER FRAME (use this when writing aim vectors):
 *    +x = the character's LEFT   +y = up   +z = the way he faces (toward camera)
 *
 *   aim  : where a bone should POINT (bone -> its child), in character frame.
 *          Axis-convention-proof: "forearm up and forward" = [0, 1, 1].
 *   rot  : local-axis degree offsets from the bind pose [x, y, z] — for head/spine/
 *          hand roll, anything aim can't express.
 *   curl : finger curl, 0 = bind pose, 1 = full fist, <0 = hyper-open.
 *   thumb: thumb curl, 0 = extended, 1 = tucked across the palm.
 *   osc  : optional looping wobble on a held pose (this is how `wave` waves).
 * ------------------------------------------------------------------ */
export type Vec3 = [number, number, number];
export type Euler3 = [number, number, number];
export interface FingerCurl { index?: number; middle?: number; ring?: number; pinky?: number; thumb?: number }
/** looping wobble layered on a held pose: rotate `bone` about local `axis` (0=x,1=y,2=z) by +-deg at hz */
export interface Osc { axis: 0 | 1 | 2; deg: number; hz: number; phase?: number }
export interface PoseDef {
  osc?: Record<string, Osc>;
  aim?: Record<string, Vec3>;
  rot?: Record<string, Euler3>;
  curl?: { L?: FingerCurl | number; R?: FingerCurl | number };
}

const FINGER_DEG = [80, 95, 60];    // proximal / middle / distal at curl = 1
const THUMB_DEG  = [15, 40, 35];

/** expand finger/thumb curl into local-axis rotations (measured: +X local = curl on every finger bone, both hands) */
export function expandCurl(def: PoseDef): Record<string, Euler3> {
  const out: Record<string, Euler3> = {};
  for (const s of ['L', 'R'] as const) {
    let c = def.curl?.[s];
    if (c === undefined) continue;
    if (typeof c === 'number') c = { index: c, middle: c, ring: c, pinky: c, thumb: 0 };
    for (const f of ['index', 'middle', 'ring', 'pinky'] as const)
      FINGER_DEG.forEach((d, i) => (out[`${f}${i + 1}${s}`] = [d * (c![f] ?? 0), 0, 0]));
    THUMB_DEG.forEach((d, i) => (out[`thumb${i + 1}${s}`] = [d * (c!.thumb ?? 0), 0, 0]));
  }
  return out;
}

/** left<->right mirror of a pose. aim.x flips; local rot flips (x, -y, -z) — verified against the bind-pose axis dump. */
export function mirror(def: PoseDef): PoseDef {
  const sw = (k: string) => k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
  const out: PoseDef = {};
  if (def.aim) out.aim = Object.fromEntries(Object.entries(def.aim).map(([k, v]) => [sw(k), [-v[0], v[1], v[2]] as Vec3]));
  if (def.rot) out.rot = Object.fromEntries(Object.entries(def.rot).map(([k, v]) => [sw(k), [v[0], -v[1], -v[2]] as Euler3]));
  if (def.curl) out.curl = { L: def.curl.R, R: def.curl.L };
  if (def.osc) out.osc = Object.fromEntries(Object.entries(def.osc).map(([k, o]) => [sw(k), { ...o, deg: o.axis === 0 ? o.deg : -o.deg }]));
  return out;
}

/** merge: later poses override earlier ones key-by-key */
export const merge = (...ps: PoseDef[]): PoseDef => ({
  aim: Object.assign({}, ...ps.map((p) => p.aim ?? {})),
  rot: Object.assign({}, ...ps.map((p) => p.rot ?? {})),
  curl: Object.assign({}, ...ps.map((p) => p.curl ?? {})),
  osc: Object.assign({}, ...ps.map((p) => p.osc ?? {})),
});

/* ------------------------------------------------------------------ *
 * POSE LIBRARY — add yours here; the viewer auto-lists them.
 * ------------------------------------------------------------------ */
// Central stance: feet shoulder-width, arms relaxed and slightly out, loose fists.
const STANCE: PoseDef = {
  aim: {
    upLegL: [0.12, -1, 0], legL: [0.08, -1, 0], footL: [0.1, -0.12, 1],
    upLegR: [-0.12, -1, 0], legR: [-0.08, -1, 0], footR: [-0.1, -0.12, 1],
  },
};
const ARM_RELAXED_L: PoseDef = { aim: { armL: [0.32, -1, 0.02], foreArmL: [0.15, -1, 0.3] }, curl: { L: 0.5 } };

export const POSES: Record<string, PoseDef> = {
  bind: {},

  neutral: merge(STANCE, ARM_RELAXED_L, mirror(ARM_RELAXED_L)),

  // right-hand thumbs-up, left hand on hip
  thumbsUp: merge(STANCE, {
    aim: {
      armR: [-0.6, -0.6, 0.55], foreArmR: [-0.15, 0.45, 0.88], handR: [-0.15, 0.45, 0.88],
      armL: [0.55, -0.83, -0.05], foreArmL: [-0.45, -0.89, 0.05],
    },
    rot: { handR: [0, 70, 0] },          // roll the fist so the thumb points straight up (found by sweep)
    curl: { R: { index: 1, middle: 1, ring: 1, pinky: 1, thumb: 0 }, L: 0.6 },
  }),

  wave: merge(STANCE, ARM_RELAXED_L, {
    aim: { armR: [-0.8, 0.2, 0.1], foreArmR: [-0.4, 1, 0.1], handR: [-0.4, 1, 0.1] },
    curl: { R: -0.15 },
    osc: { foreArmR: { axis: 2, deg: 22, hz: 2.2 } },   // local Z swings the raised forearm side to side
  }),

  handsOnHips: merge(STANCE, {
    aim: {
      armL: [0.55, -0.83, -0.05], foreArmL: [-0.45, -0.89, 0.05],
      armR: [-0.55, -0.83, -0.05], foreArmR: [0.45, -0.89, 0.05],
    },
    curl: { L: 0.6, R: 0.6 },
  }),

  flex: merge(STANCE, {
    aim: {
      armL: [1, 0.05, 0], foreArmL: [0.15, 1, 0.2], handL: [0.15, 1, 0.2],
      armR: [-1, 0.05, 0], foreArmR: [-0.15, 1, 0.2], handR: [-0.15, 1, 0.2],
    },
    curl: { L: 1, R: 1 },
  }),

  point: merge(STANCE, ARM_RELAXED_L, {
    aim: { armR: [-0.2, -0.05, 1], foreArmR: [-0.1, 0.0, 1], handR: [-0.1, 0.0, 1] },
    curl: { R: { index: -0.1, middle: 1, ring: 1, pinky: 1, thumb: 0.8 } },
  }),

  cheer: merge(STANCE, {
    aim: {
      armL: [0.5, 0.85, 0.1], foreArmL: [0.3, 1, 0.1], handL: [0.3, 1, 0.1],
      armR: [-0.5, 0.85, 0.1], foreArmR: [-0.3, 1, 0.1], handR: [-0.3, 1, 0.1],
    },
    curl: { L: 0.9, R: 0.9 },
  }),
};

export function rotToEuler(r: Record<string, Euler3>) {
  const out = new Map<string, THREE.Euler>();
  for (const [k, [x, y, z]] of Object.entries(r))
    out.set(k, new THREE.Euler(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z), 'XYZ'));
  return out;
}
