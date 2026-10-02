// From the user-supplied Vault Boy rig kit. Non-commercial fan use.
import * as THREE from 'three';

/** One knob drives the whole look: `color`. Everything else is derived from it. */
export interface PhosphorStyle {
  color: THREE.ColorRepresentation; // the single character colour
  fill: number;        // 0..1  interior glow (glass body)
  rim: number;         // 0..3  edge glow strength (fresnel)
  rimPower: number;    // 1..6  edge tightness
  lines: number;       // 0..2  contour-grid strength
  lineDensity: number; // lines per unit (rest-pose space)
  wire: number;        // 0..1  true mesh-wireframe overlay opacity
  scan: number;        // 0..1  CRT scanline strength
  glass: boolean;      // false = opaque dark shell + wire on top (readable, default). true = see-through additive glass
}

export const DEFAULT_STYLE: PhosphorStyle = {
  color: '#3dff6a',
  fill: 0.0,            // faint interior so the silhouette reads against the black
  rim: 0.3,
  rimPower: 3.0,
  lines: 0.0,          // contour grid off by default: the real mesh wire is the structure now
  lineDensity: 14,
  wire: 0.6,
  scan: 0.2,
  glass: false,
};

/** UnrealBloomPass settings that pair with DEFAULT_STYLE (the glow is half the look) */
export const BLOOM = { strength: 0.1, radius: 0.25, threshold: 0.4 };

const VERT = /* glsl */ `
#include <common>
#include <skinning_pars_vertex>
varying vec3 vN;
varying vec3 vV;
varying vec3 vRest;
void main() {
  vRest = position;                       // rest-pose coords: lines ride the body as it deforms
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <skinning_vertex>
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vN = normalize(transformedNormal);
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3  uColor;
uniform float uFill, uRim, uRimPower, uLines, uDensity, uScan;
varying vec3 vN; varying vec3 vV; varying vec3 vRest;

float contour(float v) {
  float w = fwidth(v) * 1.2;
  float d = abs(fract(v - 0.5) - 0.5);
  return 1.0 - smoothstep(0.0, w, d);
}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  if (!gl_FrontFacing) N = -N;
  float ndv   = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fres  = pow(1.0 - ndv, uRimPower);
  float side  = gl_FrontFacing ? 1.0 : 0.45;            // back faces read dimmer = glass depth

  vec3 p = vRest * uDensity;
  float g = max(max(contour(p.x), contour(p.y)), contour(p.z));

  float e = uFill + fres * uRim + g * uLines * (0.35 + 0.65 * (1.0 - ndv));
  vec3 col = uColor * e * side;
  col += vec3(0.55) * pow(fres, 3.0) * uRim * 0.35 * side * uColor;  // hot edge, tinted not white
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.6);
  col *= mix(1.0, 0.7 + 0.3 * scan, uScan);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createPhosphor(style: PhosphorStyle) {
  const color = new THREE.Color(style.color);
  const body = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: color },
      uFill: { value: style.fill },
      uRim: { value: style.rim },
      uRimPower: { value: style.rimPower },
      uLines: { value: style.lines },
      uDensity: { value: style.lineDensity },
      uScan: { value: style.scan },
    },
  });
  applyGlass(body, style.glass);
  const wire = new THREE.MeshBasicMaterial({
    color, wireframe: true, transparent: true, opacity: style.wire,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return { body, wire, color };
}

/** glass=false: opaque front-face shell (hides back faces, lets the front wire read clearly).
 *  glass=true : see-through additive shell (the original blown-out hologram). */
export function applyGlass(m: THREE.ShaderMaterial, glass: boolean) {
  m.side = glass ? THREE.DoubleSide : THREE.FrontSide;
  m.transparent = glass;
  m.blending = glass ? THREE.AdditiveBlending : THREE.NormalBlending;
  m.depthWrite = !glass;
  m.polygonOffset = !glass;           // push the shell back a hair so the wire on top passes the depth test
  m.polygonOffsetFactor = 1; m.polygonOffsetUnits = 1;
  m.needsUpdate = true;
}


/**
 * Hue-safe exposure limiter. Additive glow stacks past 1.0, and clipping per channel
 * drags any non-green colour toward white/yellow. Dividing by the brightest channel
 * keeps the HUE no matter how much light piles up. Add it right AFTER the bloom pass.
 */
export const HueSafeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uKnee: { value: 0.85 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uKnee; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float m = max(c.r, max(c.g, c.b));
      // soft-knee: linear below the knee, asymptotically approaches 1.0 above it
      float k = uKnee;
      float mapped = m < k ? m : k + (1.0 - k) * (1.0 - exp(-(m - k) / (1.0 - k)));
      c.rgb *= m > 1e-5 ? mapped / m : 1.0;
      gl_FragColor = vec4(c.rgb, 1.0);
    }`,
};
