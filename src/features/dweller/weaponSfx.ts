import { readStored } from '../../lib/contracts'
import { DEFAULT_SETTINGS, type Settings } from '../../lib/profile'

/**
 * Synthesized weapon sounds for the STATUS weapon slot (no game audio). Its own small
 * AudioContext, opened on the first weapon tap (always a user gesture). Every sound checks
 * SYSTEM > PREFERENCES sound on/off and volume at play time.
 */
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): { ctx: AudioContext; out: GainNode } | null {
  const s = readStored<Settings>('settings', DEFAULT_SETTINGS)
  if (!s.sound || typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    try {
      ctx = new AC()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  const out = ctx.createGain()
  out.gain.value = Math.max(0, Math.min(1, s.volume)) * 0.6
  out.connect(ctx.destination)
  return { ctx, out }
}

function noiseBuf(c: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === c.sampleRate) return noise
  noise = c.createBuffer(1, c.sampleRate * 3, c.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return noise
}

type Env = { at?: number; peak: number; attack?: number; dur: number }
function env(c: AudioContext, g: GainNode, { at = 0, peak, attack = 0.004, dur }: Env) {
  const t = c.currentTime + at
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  return t
}

function tone(freq: number, to: number, dur: number, peak: number, type: OscillatorType = 'sine', at = 0) {
  const a = audio()
  if (!a) return
  const o = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  o.type = type
  const t = env(a.ctx, g, { at, peak, dur })
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(to, t + dur)
  o.connect(g).connect(a.out)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function hiss(dur: number, peak: number, filter: BiquadFilterType, freq: number, to = freq, q = 1, at = 0) {
  const a = audio()
  if (!a) return
  const src = a.ctx.createBufferSource()
  src.buffer = noiseBuf(a.ctx)
  const f = a.ctx.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  const g = a.ctx.createGain()
  const t = env(a.ctx, g, { at, peak, dur, attack: Math.min(0.01, dur / 4) })
  f.frequency.setValueAtTime(freq, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  src.connect(f).connect(g).connect(a.out)
  src.start(t, Math.random(), dur + 0.05)
}

export const weaponSfx = {
  /** Swap: a two-part click-clack. */
  swap: () => (tone(1400, 900, 0.03, 0.12, 'square'), tone(700, 500, 0.04, 0.1, 'square', 0.07)),
  /** Fist: a meaty thump. */
  punch: () => (hiss(0.09, 0.6, 'lowpass', 900, 200, 0.7), tone(150, 45, 0.16, 0.7)),
  /** Water pistol: a wet pssht with a little bloop. */
  squirt: () => (hiss(0.16, 0.35, 'bandpass', 2600, 4200, 1.4), tone(520, 1300, 0.08, 0.12, 'sine', 0.02)),
  /** Pulling the trigger on an empty tank. */
  dry: () => tone(2200, 1800, 0.02, 0.12, 'square'),
  /** Refill: glug-glug then a click. */
  reload: () => [0, 0.14, 0.28].forEach((d, i) => tone(240 + i * 70, 420 + i * 90, 0.09, 0.25, 'sine', d)),
  /** Nuke equipped / confirm window: a two-tone warning. */
  arm: () => [0, 0.18, 0.36].forEach((d, i) => tone(i % 2 ? 660 : 880, i % 2 ? 640 : 860, 0.15, 0.13, 'square', d)),
  /** The big one: noise blast sweeping down, a sub drop, and a rumbling tail. */
  boom: () => {
    const a = audio()
    if (!a) return
    // crunch: soft-clip the blast so it feels loud without being loud
    const shaper = a.ctx.createWaveShaper()
    const curve = new Float32Array(1024)
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 3)
    }
    shaper.curve = curve
    shaper.connect(a.out)

    const src = a.ctx.createBufferSource()
    src.buffer = noiseBuf(a.ctx)
    const lp = a.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.8
    const g = a.ctx.createGain()
    const t = env(a.ctx, g, { peak: 0.9, attack: 0.006, dur: 2.8 })
    lp.frequency.setValueAtTime(5000, t)
    lp.frequency.exponentialRampToValueAtTime(380, t + 0.35)
    lp.frequency.exponentialRampToValueAtTime(70, t + 2.6)
    src.connect(lp).connect(g).connect(shaper)
    src.start(t, 0, 2.9)

    const sub = a.ctx.createOscillator()
    const sg = a.ctx.createGain()
    sub.type = 'sine'
    env(a.ctx, sg, { peak: 0.95, attack: 0.01, dur: 1.9 })
    sub.frequency.setValueAtTime(90, t)
    sub.frequency.exponentialRampToValueAtTime(26, t + 1.6)
    sub.connect(sg).connect(shaper)
    sub.start(t)
    sub.stop(t + 2)
  },
  /** The reboot tail: a falling whine, like a tube powering down. */
  powerDown: () => tone(1800, 60, 0.9, 0.08, 'sawtooth'),
}
