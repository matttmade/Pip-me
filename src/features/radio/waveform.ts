/**
 * Real loudness for the streamed station. The SoundCloud widget's audio is cross-origin
 * (no Web Audio), but every track has a public waveform: a JSON list of peak heights
 * (`waveform_url`, e.g. https://wave.sndcdn.com/<id>_m.json, served with
 * `Access-Control-Allow-Origin: *`). Mapped against the widget's playhead it gives the
 * oscilloscope a loudness envelope that follows the music. All pure, no DOM.
 */

/** Amplitude envelope across the whole track: values 0-1, evenly spaced in time. */
export type Envelope = Float32Array

const WAVE_HOST = /^https:\/\/wave\.sndcdn\.com\/[\w-]+\.(png|json)(\?.*)?$/

/** Track `waveform_url` → its JSON variant, or null when it isn't a SoundCloud waveform. */
export function waveformJsonUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const m = WAVE_HOST.exec(url.trim())
  if (!m) return null
  return url.trim().replace(/\.png(\?|$)/, '.json$1')
}

/**
 * Waveform JSON ({width, height, samples}) → envelope. Heights are scaled by `height`,
 * then stretched so the loudest stretch of the track reaches 1 and the quietest
 * steady level sits near 0.1 (SoundCloud waveforms rarely drop below ~15% of height).
 * Returns null for anything unusable.
 */
export function normalizeEnvelope(json: unknown): Envelope | null {
  if (!json || typeof json !== 'object') return null
  const { samples, height } = json as { samples?: unknown; height?: unknown }
  if (!Array.isArray(samples) || samples.length < 2) return null
  const vals = samples.map((v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0))
  const h = typeof height === 'number' && height > 0 ? height : Math.max(...vals)
  if (!(h > 0)) return null
  const sorted = [...vals].sort((a, b) => a - b)
  const floor = sorted[Math.floor(sorted.length * 0.02)] / h
  const peak = sorted[Math.floor((sorted.length - 1) * 0.995)] / h
  const span = peak - floor
  const out = new Float32Array(vals.length)
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i] / h
    out[i] = span > 0.02 ? clamp01(0.1 + (0.9 * (v - floor)) / span) : clamp01(v)
  }
  return out
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Fractional sample index for a playhead (ms) on a track of `duration` ms. */
function indexAt(env: Envelope, position: number, duration: number): number {
  if (!(duration > 0) || !Number.isFinite(position)) return 0
  return clamp01(position / duration) * (env.length - 1)
}

/** Loudness 0-1 at the playhead, linearly interpolated between samples. */
export function envelopeAt(env: Envelope, position: number, duration: number): number {
  if (env.length === 0) return 0
  const f = indexAt(env, position, duration)
  const i = Math.floor(f)
  const j = Math.min(env.length - 1, i + 1)
  return env[i] + (env[j] - env[i]) * (f - i)
}

/** Change in loudness per sample at the playhead (-1..1): positive while the music swells. */
export function envelopeSlope(env: Envelope, position: number, duration: number): number {
  if (env.length < 2) return 0
  const i = Math.min(env.length - 2, Math.floor(indexAt(env, position, duration)))
  return env[i + 1] - env[i]
}

/**
 * `n` loudness values covering `spanMs` of the track centered on the playhead
 * (outside the track = 0), for the scrolling history strip.
 */
export function envelopeWindow(env: Envelope, position: number, duration: number, spanMs: number, n: number): number[] {
  const out: number[] = []
  if (!(duration > 0) || n < 1) return out
  for (let k = 0; k < n; k++) {
    const t = position - spanMs / 2 + (spanMs * (k + 0.5)) / n
    out.push(t < 0 || t > duration ? 0 : envelopeAt(env, t, duration))
  }
  return out
}

/**
 * Playhead between widget PLAY_PROGRESS events: the last reported position plus the
 * time since it arrived (only while playing, and at most `maxGapMs`, so a stalled
 * stream doesn't run away), kept inside the track.
 */
export function extrapolatePlayhead(position: number, at: number, now: number, playing: boolean, duration: number, maxGapMs = 1500): number {
  const p = playing ? position + Math.min(maxGapMs, Math.max(0, now - at)) : position
  return duration > 0 ? Math.min(duration, Math.max(0, p)) : Math.max(0, p)
}

/** Small deterministic hash noise in -1..1. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

/**
 * Oscilloscope trace driven by the real loudness. x in [0, 1] across the screen, t in
 * seconds, level 0-1 (envelope at the playhead × volume), slope from envelopeSlope.
 * Louder passages are taller and richer in harmonics; swells (|slope|) add grit.
 */
export function envelopeSignal(x: number, t: number, level: number, slope = 0): number {
  if (level <= 0) return 0
  const phase = x * Math.PI * 2
  const rich = 0.25 + 0.75 * level
  const grit = Math.min(1, Math.abs(slope) * 6)
  // A fast "beat" wobble so the amplitude breathes within one envelope sample.
  const beat = 0.82 + 0.18 * Math.sin(t * 7.3 + Math.sin(t * 1.9) * 2)
  let v =
    0.6 * Math.sin(phase * 2.5 + t * 2.4) +
    0.28 * rich * Math.sin(phase * 6.1 - t * 3.7 + Math.sin(t * 0.8) * 2) +
    0.16 * rich * rich * Math.sin(phase * 15 + t * 11.3) +
    0.08 * rich * rich * Math.sin(phase * 37 + t * 27 + Math.sin(t * 4.1))
  v += (0.06 + 0.22 * grit) * level * hash(Math.floor(x * 180) + Math.floor(t * 30) * 997)
  return Math.max(-1, Math.min(1, v * level * beat))
}
