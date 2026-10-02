import { on, type AppEvent } from '../../lib/events'
import { DEFAULT_SETTINGS, type Settings } from '../../lib/profile'
import { readStored } from '../../lib/store'

/**
 * Synthesized UI sounds (no game audio). The AudioContext is created on the first
 * user gesture, and every sound checks SYSTEM > PREFERENCES (sound on/off, volume).
 */
let ctx: AudioContext | null = null
let master: GainNode | null = null
let started = false

const settings = () => readStored<Settings>('settings', DEFAULT_SETTINGS)

function audio(): { ctx: AudioContext; out: GainNode } | null {
  const s = settings()
  if (!s.sound || !ctx || !master) return null
  if (ctx.state === 'suspended') void ctx.resume()
  master.gain.value = s.volume * 0.5
  return { ctx, out: master }
}

function blip(freq: number, dur = 0.04, type: OscillatorType = 'square', gain = 0.15, slideTo?: number, delay = 0) {
  const a = audio()
  if (!a) return
  const t = a.ctx.currentTime + delay
  const osc = a.ctx.createOscillator()
  const g = a.ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.out)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

let noiseBuf: AudioBuffer | null = null
function crackle(dur = 0.12, gain = 0.2) {
  const a = audio()
  if (!a) return
  if (!noiseBuf) {
    noiseBuf = a.ctx.createBuffer(1, a.ctx.sampleRate * 0.5, a.ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.2)
  }
  const src = a.ctx.createBufferSource()
  src.buffer = noiseBuf
  const filter = a.ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 2400
  filter.Q.value = 0.8
  const g = a.ctx.createGain()
  const t = a.ctx.currentTime
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(a.out)
  src.start(t, Math.random() * 0.3, dur)
}

export const sfx = {
  tab: () => (blip(520, 0.05, 'square', 0.08), crackle(0.05, 0.06)),
  tick: () => blip(1800, 0.015, 'square', 0.05),
  select: () => (blip(880, 0.05, 'square', 0.08), blip(1320, 0.06, 'square', 0.06, undefined, 0.05)),
  glitch: () => crackle(0.14, 0.12),
  success: () => [660, 880, 1320].forEach((f, i) => blip(f, 0.09, 'square', 0.08, undefined, i * 0.09)),
  fail: () => blip(220, 0.25, 'sawtooth', 0.1, 110),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.12, 'triangle', 0.12, undefined, i * 0.1)),
  boot: () => (blip(90, 0.6, 'sawtooth', 0.06, 180), crackle(0.4, 0.08)),
}

const handlers: Partial<Record<AppEvent['type'], () => void>> = {
  'tab-change': sfx.tab,
  'subtab-change': sfx.tab,
  'list-move': sfx.tick,
  'list-select': sfx.select,
  glitch: sfx.glitch,
  'level-up': sfx.levelUp,
  'quest-complete': sfx.success,
}

/** Call once at startup. Idempotent. */
export function startSfx(): void {
  if (started || typeof window === 'undefined') return
  started = true
  const unlock = () => {
    if (ctx) return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx = new AC()
    master = ctx.createGain()
    master.connect(ctx.destination)
  }
  window.addEventListener('pointerdown', unlock, { capture: true })
  window.addEventListener('keydown', unlock, { capture: true })
  on('*', (e) => {
    if (e.type === 'hack-result') return e.success ? sfx.success() : sfx.fail()
    handlers[e.type]?.()
  })
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.visibilityState === 'hidden') void ctx.suspend()
    else void ctx.resume()
  })
}
