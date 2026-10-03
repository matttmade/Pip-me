import { Color, DataTexture, LinearFilter, RGBAFormat, SRGBColorSpace, Vector2 } from 'three'
import { hslToRgb, pipRgb } from '../../lib/contracts'
import { bakeRamp } from './fidelity'

/**
 * Pip-Boy monochrome post-process: luminance → 4 tones of the current Pip hue with
 * 4×4 ordered (Bayer) dithering and optional chunky pixels. Transparent background
 * stays transparent; a 1px bright outline is drawn around the silhouette so the figure
 * reads like Pip-Boy line art on the dark screen.
 */
export const PipMonochromeShader = {
  name: 'PipMonochromeShader',
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new Vector2(240, 320) },
    pixelSize: { value: 1 },
    tone0: { value: new Color() },
    tone1: { value: new Color() },
    tone2: { value: new Color() },
    tone3: { value: new Color() },
    outline: { value: 1 },
    lift: { value: 0.14 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float pixelSize;
    uniform vec3 tone0;
    uniform vec3 tone1;
    uniform vec3 tone2;
    uniform vec3 tone3;
    uniform float outline;
    uniform float lift;
    varying vec2 vUv;

    // Recursive Bayer matrix: exact 2x2 / 4x4 thresholds in [0, 15/16] for integer cells.
    float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }

    void main() {
      vec2 grid = resolution / max(pixelSize, 1.0);
      vec2 cell = floor(vUv * grid);
      vec2 uv = (cell + 0.5) / grid;
      vec4 c = texture2D(tDiffuse, uv);

      if (c.a < 0.5) {
        vec2 d = 1.0 / grid;
        float n = max(
          max(texture2D(tDiffuse, uv + vec2(d.x, 0.0)).a, texture2D(tDiffuse, uv - vec2(d.x, 0.0)).a),
          max(texture2D(tDiffuse, uv + vec2(0.0, d.y)).a, texture2D(tDiffuse, uv - vec2(0.0, d.y)).a)
        );
        gl_FragColor = (outline > 0.5 && n >= 0.5) ? vec4(tone3, 1.0) : vec4(0.0);
        return;
      }

      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      l = sqrt(clamp(l, 0.0, 1.0));          // linear → roughly perceptual
      l = lift + (1.0 - lift) * l;            // keep the body off the background tone
      float v = l * 3.0;
      float base = floor(v);
      float idx = clamp(base + step(bayer4(cell) + 1.0 / 32.0, v - base), 0.0, 3.0);
      vec3 col = idx < 0.5 ? tone0 : idx < 1.5 ? tone1 : idx < 2.5 ? tone2 : tone3;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
}

type Uniforms = typeof PipMonochromeShader.uniforms

const srgb = (c: Color, [r, g, b]: [number, number, number]) => c.setRGB(r / 255, g / 255, b / 255, SRGBColorSpace)

/** Point the 4-tone ramp at a hue. Darkest tone = the screen background, hsl(hue 60% 4%). */
export function setPipHue(u: Uniforms, hue: number): void {
  srgb(u.tone0.value, hslToRgb(hue, 0.6, 0.04))
  srgb(u.tone1.value, pipRgb(hue, 0.2))
  srgb(u.tone2.value, pipRgb(hue, 0.4))
  srgb(u.tone3.value, pipRgb(hue, 0.62))
}

/**
 * CLEAN / HI-FI post-process: luminance → a continuous dark→pip→pip-hi ramp (a baked 1D
 * lookup texture), with an antialiased silhouette line, and very faint horizontal scan
 * banding so it still reads as a CRT readout. Input is MSAA-resolved, so its alpha is coverage:
 * colour is un-premultiplied before the lookup and the output is premultiplied again.
 */
export const PipSmoothShader = {
  name: 'PipSmoothShader',
  uniforms: {
    tDiffuse: { value: null },
    tRamp: { value: null as DataTexture | null },
    resolution: { value: new Vector2(240, 320) },
    lift: { value: 0.12 },
    outlinePx: { value: 1.25 },
    outline: { value: 0.75 },
    scanPeriod: { value: 3 },
    scanDepth: { value: 0.12 },
  },
  vertexShader: PipMonochromeShader.vertexShader,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tRamp;
    uniform vec2 resolution;
    uniform float lift;
    uniform float outlinePx;
    uniform float outline;
    uniform float scanPeriod;
    uniform float scanDepth;
    varying vec2 vUv;

    vec3 ramp(float t) { return texture2D(tRamp, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb; }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float a = clamp(c.a, 0.0, 1.0);
      vec3 rgb = a > 0.001 ? c.rgb / a : vec3(0.0);
      float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      l = lift + (1.0 - lift) * sqrt(clamp(l, 0.0, 1.0));
      vec3 col = ramp(l);

      // Silhouette line: how much more covered the neighbourhood is than this pixel.
      vec2 d = outlinePx / resolution;
      float n = 0.0;
      n = max(n, texture2D(tDiffuse, vUv + vec2(d.x, 0.0)).a);
      n = max(n, texture2D(tDiffuse, vUv - vec2(d.x, 0.0)).a);
      n = max(n, texture2D(tDiffuse, vUv + vec2(0.0, d.y)).a);
      n = max(n, texture2D(tDiffuse, vUv - vec2(0.0, d.y)).a);
      n = max(n, 0.8 * texture2D(tDiffuse, vUv + d * 0.7071).a);
      n = max(n, 0.8 * texture2D(tDiffuse, vUv - d * 0.7071).a);
      n = max(n, 0.8 * texture2D(tDiffuse, vUv + vec2(d.x, -d.y) * 0.7071).a);
      n = max(n, 0.8 * texture2D(tDiffuse, vUv + vec2(-d.x, d.y) * 0.7071).a);
      float edge = clamp(n - a, 0.0, 1.0) * outline;

      vec3 outc = col * a + ramp(0.9) * edge;
      float outa = clamp(a + edge, 0.0, 1.0);

      // Faint scan banding: a soft dip once per period, like the --band token.
      float ph = fract(gl_FragCoord.y / scanPeriod);
      float band = 1.0 - scanDepth * smoothstep(0.45, 0.75, ph) * smoothstep(1.0, 0.8, ph);
      gl_FragColor = vec4(outc * band, outa);
    }
  `,
}

/** Bake (or re-bake) the smooth ramp for `hue` into the shader's lookup texture. */
export function setSmoothHue(u: typeof PipSmoothShader.uniforms, hue: number): void {
  const data = bakeRamp(hue, 256)
  let tex = u.tRamp.value
  if (!tex) {
    tex = new DataTexture(data, 256, 1, RGBAFormat)
    tex.colorSpace = SRGBColorSpace
    tex.magFilter = LinearFilter
    tex.minFilter = LinearFilter
    tex.generateMipmaps = false
    u.tRamp.value = tex
  } else {
    ;(tex.image.data as Uint8Array).set(data)
  }
  tex.needsUpdate = true
}
