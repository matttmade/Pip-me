/**
 * Procedural radio stations. Each is a Web Audio graph factory that wires itself into
 * `out` and returns a handle to stop it. No audio files ship with the app.
 */
import { mulberry32, randInt, type Rng } from '../../lib/seed'

export type StationGraph = {
  stop(): void
  /** Optional: pause sources that keep running while the context is suspended (media elements). */
  setPaused?(paused: boolean): void
}
export type StationFactory = (ctx: AudioContext, out: AudioNode) => StationGraph
export type Station = { id: string; name: string; freq: string; desc: string; start: StationFactory }

/* ---------- helpers ---------- */

function noiseBuffer(ctx: BaseAudioContext, seconds = 2, seed = 7): AudioBuffer {
  const rng = mulberry32(seed)
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1
  return buf
}

function noiseSource(ctx: AudioContext, seed?: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx, 2, seed)
  src.loop = true
  return src
}

/** Calls `schedule(until)` every 100 ms so events can be queued ~0.4 s ahead of playback. */
function lookahead(ctx: AudioContext, schedule: (until: number) => void): () => void {
  const tick = () => schedule(ctx.currentTime + 0.4)
  tick()
  const id = window.setInterval(tick, 100)
  return () => window.clearInterval(id)
}

/** A short enveloped tone. */
function blip(ctx: AudioContext, out: AudioNode, t: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(peak, t + Math.min(0.01, dur / 4))
  g.gain.setTargetAtTime(0, t + dur * 0.6, dur / 4)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.3)
  osc.onended = () => g.disconnect()
}

function stopAll(nodes: AudioScheduledSourceNode[], others: AudioNode[] = []) {
  for (const n of nodes) {
    try {
      n.stop()
    } catch {
      // already stopped
    }
    n.disconnect()
  }
  others.forEach((n) => n.disconnect())
}

/* ---------- 1. drone ---------- */

const hum: StationFactory = (ctx, out) => {
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  filter.Q.value = 5
  const level = ctx.createGain()
  level.gain.value = 0.16
  filter.connect(level).connect(out)

  const voices: [OscillatorType, number, number][] = [
    ['sawtooth', 55, 0.5],
    ['sawtooth', 55.35, 0.5],
    ['triangle', 82.6, 0.6],
    ['sine', 110.2, 0.5],
    ['sine', 164.9, 0.15],
  ]
  const oscs = voices.map(([type, f, g]) => {
    const o = ctx.createOscillator()
    const gain = ctx.createGain()
    o.type = type
    o.frequency.value = f
    gain.gain.value = g
    o.connect(gain).connect(filter)
    return o
  })

  // Slow filter sweep + gentle swell.
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.06
  const lfoAmt = ctx.createGain()
  lfoAmt.gain.value = 260
  lfo.connect(lfoAmt).connect(filter.frequency)
  const swell = ctx.createOscillator()
  swell.frequency.value = 0.11
  const swellAmt = ctx.createGain()
  swellAmt.gain.value = 0.05
  swell.connect(swellAmt).connect(level.gain)

  const all = [...oscs, lfo, swell]
  all.forEach((o) => o.start())
  return { stop: () => stopAll(all, [filter, level, lfoAmt, swellAmt]) }
}

/* ---------- 2. morse numbers ---------- */

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---',
  3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
}

export const MORSE_MESSAGE = 'KV7 KV7 LIGHTS STILL ON AT 111 KEEP THE DOOR SHUT'

/** Beep timeline in morse units: [startUnit, lengthUnits][] plus the loop length. */
export function morseTimeline(message: string): { beeps: [number, number][]; units: number } {
  const beeps: [number, number][] = []
  let t = 0
  for (const word of message.toUpperCase().split(/\s+/).filter(Boolean)) {
    for (const ch of word) {
      const code = MORSE[ch]
      if (!code) continue
      for (const sym of code) {
        const len = sym === '.' ? 1 : 3
        beeps.push([t, len])
        t += len + 1 // intra-character gap
      }
      t += 2 // character gap (3 total)
    }
    t += 4 // word gap (7 total)
  }
  return { beeps, units: t + 14 } // pause before repeating
}

const numbers: StationFactory = (ctx, out) => {
  const unit = 1.2 / 17 // ~17 wpm
  const { beeps, units } = morseTimeline(MORSE_MESSAGE)
  const loopLen = units * unit

  const tone = ctx.createOscillator()
  tone.frequency.value = 680
  const key = ctx.createGain()
  key.gain.value = 0
  const level = ctx.createGain()
  level.gain.value = 0.22
  tone.connect(key).connect(level).connect(out)

  // A thin bed of band-limited static under the tones.
  const hiss = noiseSource(ctx, 11)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 2400
  band.Q.value = 0.8
  const hissLevel = ctx.createGain()
  hissLevel.gain.value = 0.035
  hiss.connect(band).connect(hissLevel).connect(out)

  let loopStart = ctx.currentTime + 0.3
  let idx = 0
  const cancel = lookahead(ctx, (until) => {
    while (loopStart + beeps[idx][0] * unit < until) {
      const [s, len] = beeps[idx]
      const t = loopStart + s * unit
      key.gain.setTargetAtTime(1, t, 0.004)
      key.gain.setTargetAtTime(0, t + len * unit, 0.004)
      if (++idx === beeps.length) {
        idx = 0
        loopStart += loopLen
      }
    }
  })
  tone.start()
  hiss.start()
  return {
    stop: () => {
      cancel()
      stopAll([tone, hiss], [key, level, band, hissLevel])
    },
  }
}

/* ---------- 3. static + tones ---------- */

const sermon: StationFactory = (ctx, out) => {
  const noise = noiseSource(ctx, 3)
  const band = ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = 1100
  band.Q.value = 0.9
  const level = ctx.createGain()
  level.gain.value = 0.13
  noise.connect(band).connect(level).connect(out)

  // "Tuning" drift on the noise band.
  const drift = ctx.createOscillator()
  drift.frequency.value = 0.09
  const driftAmt = ctx.createGain()
  driftAmt.gain.value = 700
  drift.connect(driftAmt).connect(band.frequency)

  const tones = ctx.createGain()
  tones.gain.value = 0.2
  tones.connect(out)
  const rng: Rng = mulberry32(1945)
  const SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5]
  let next = ctx.currentTime + 0.5
  const cancel = lookahead(ctx, (until) => {
    while (next < until) {
      const burst = randInt(rng, 1, 4)
      for (let k = 0; k < burst; k++) {
        blip(ctx, tones, next + k * 0.11, SCALE[randInt(rng, 0, SCALE.length - 1)], 0.06 + rng() * 0.22, 0.25 + rng() * 0.4)
      }
      next += 0.35 + rng() * 1.6
    }
  })
  noise.start()
  drift.start()
  return {
    stop: () => {
      cancel()
      stopAll([noise, drift], [band, level, driftAmt, tones])
    },
  }
}

/* ---------- 4. procedural lo-fi melody ---------- */

const lullaby: StationFactory = (ctx, out) => {
  const rng = mulberry32(2077)
  const bpm = 78
  const eighth = 60 / bpm / 2
  // A minor pentatonic across two octaves.
  const scale = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25]
  const roots = [110, 87.31, 130.81, 98] // A, F, C, G
  const makePhrase = () => Array.from({ length: 16 }, () => (rng() < 0.28 ? -1 : randInt(rng, 0, scale.length - 1)))
  let phrase = makePhrase()

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1800
  const level = ctx.createGain()
  level.gain.value = 0.32
  tone.connect(level).connect(out)

  // Record crackle.
  const crackle = noiseSource(ctx, 5)
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 3500
  const crackleLevel = ctx.createGain()
  crackleLevel.gain.value = 0.025
  crackle.connect(hp).connect(crackleLevel).connect(out)

  let step = 0
  let next = ctx.currentTime + 0.3
  const cancel = lookahead(ctx, (until) => {
    while (next < until) {
      const bar = Math.floor(step / 8) % roots.length
      const n = phrase[step % 16]
      if (n >= 0) blip(ctx, tone, next, scale[n], eighth * (rng() < 0.3 ? 2 : 1.1), 0.35, 'triangle')
      if (step % 4 === 0) blip(ctx, tone, next, roots[bar], eighth * 3.5, 0.5, 'sine')
      if (step % 8 === 4) blip(ctx, tone, next, roots[bar] * 1.5, eighth * 2, 0.18, 'sine')
      step++
      if (step % 64 === 0) phrase = rng() < 0.5 ? makePhrase() : phrase.map((p) => (rng() < 0.2 ? randInt(rng, 0, scale.length - 1) : p))
      next += eighth * (step % 2 ? 1.08 : 0.92) // a little swing
    }
  })
  crackle.start()
  return {
    stop: () => {
      cancel()
      stopAll([crackle], [tone, level, hp, crackleLevel])
    },
  }
}

/* ---------- 5. local file ---------- */

/** Plays a user-picked file (object URL). The file never leaves the device. */
export function fileStation(url: string): StationFactory {
  return (ctx, out) => {
    const el = new Audio(url)
    el.loop = true
    const src = ctx.createMediaElementSource(el)
    src.connect(out)
    void el.play().catch(() => {})
    return {
      stop: () => {
        el.pause()
        src.disconnect()
        el.removeAttribute('src')
        el.load()
      },
      setPaused: (p) => void (p ? el.pause() : el.play().catch(() => {})),
    }
  }
}

export const YOUR_STATION = 'YOURS'

export const STATIONS: Station[] = [
  {
    id: 'HUM',
    name: "OVERSEER'S HUM",
    freq: '88.1',
    desc: 'A low, patient drone piped from the vault reactor level. Residents report improved sleep and mild déjà vu.',
    start: hum,
  },
  {
    id: 'NUMBERS',
    name: 'MERIDIAN NUMBERS',
    freq: '93.7',
    desc: 'An unmanned relay keying the same short message in code, over and over, since nobody remembers when.',
    start: numbers,
  },
  {
    id: 'SERMON',
    name: 'STATIC SERMON',
    freq: '101.3',
    desc: 'Wide-band static with stray tones bleeding through. Some listeners swear it is trying to say something.',
    start: sermon,
  },
  {
    id: 'LULLABY',
    name: 'ATOMIC LULLABY',
    freq: '106.9',
    desc: 'Soft generative melodies on a warm crackle. Composed fresh each loop by a very tired jukebox.',
    start: lullaby,
  },
]
