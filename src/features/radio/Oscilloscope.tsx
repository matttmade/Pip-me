import { useEffect, useRef } from 'react'
import { envelopeAt, envelopeSignal, envelopeSlope, envelopeWindow, type Envelope } from './waveform'

/** What drives the trace. */
export type ScopeSource =
  /** Real audio from the Web Audio graph: time-domain trace over faint spectrum bars. */
  | { kind: 'analyser'; analyser: AnalyserNode }
  /** Streamed track: trace shaped by the real loudness envelope at the playhead, plus a loudness strip. */
  | { kind: 'envelope'; envelope: Envelope; playhead: () => number; duration: number; gain: number }
  /** Fallback when nothing real is available: (x 0-1, t seconds) -> -1..1. */
  | { kind: 'sim'; fn: (x: number, t: number) => number }

type Props = {
  /** null draws a flat line. */
  source: ScopeSource | null
  /** "r, g, b" of the current Pip hue. */
  color: string
  /** Animate only while audible, visible and motion is allowed; otherwise draw a still frame. */
  running: boolean
}

const BARS = 48
/** Width of the loudness strip in envelope samples (each ~5 s on a long mix). */
const STRIP_SAMPLES = 56

/** Pip-Boy style oscilloscope: tick rulers, glowing phosphor trace with a short afterglow. */
export function Oscilloscope({ source, color, running }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  /** Last animated time, so a paused trace freezes where it was. */
  const frozenT = useRef(1.7)

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const an = source?.kind === 'analyser' ? source.analyser : null
    const wave = new Uint8Array(an?.fftSize ?? 0)
    const freq = new Uint8Array(an?.frequencyBinCount ?? 0)
    const N = 256
    const ys = new Float32Array(N)
    let ghost: Float32Array | null = null
    let raf = 0

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        ghost = null
      }
      return dpr
    }

    /** Fills ys (-1..1) for this frame and draws the background layer. Returns false for a flat line. */
    const sample = (w: number, h: number, dpr: number, t: number): boolean => {
      if (!source) return false
      if (source.kind === 'sim') {
        for (let i = 0; i < N; i++) ys[i] = source.fn(i / (N - 1), t)
        return true
      }
      if (source.kind === 'envelope') {
        const { envelope: env, duration } = source
        const pos = source.playhead()
        const level = envelopeAt(env, pos, duration) * source.gain
        const slope = envelopeSlope(env, pos, duration)
        for (let i = 0; i < N; i++) ys[i] = envelopeSignal(i / (N - 1), t, level, slope)
        // Loudness strip along the bottom: past on the left, upcoming (dimmer) on the right.
        const span = (duration / env.length) * STRIP_SAMPLES
        const bars = envelopeWindow(env, pos, duration, span, BARS)
        const stripH = h * 0.24
        const bw = w / BARS
        for (let k = 0; k < BARS; k++) {
          const bh = Math.max(1 * dpr, bars[k] * stripH)
          g.fillStyle = `rgba(${color}, ${k < BARS / 2 ? 0.26 : 0.1})`
          g.fillRect(k * bw + bw * 0.18, h - bh, bw * 0.64, bh)
        }
        g.fillStyle = `rgba(${color}, 0.7)`
        g.fillRect(w / 2 - 0.5 * dpr, h - stripH - 4 * dpr, 1 * dpr, stripH + 4 * dpr)
        return true
      }
      const a = source.analyser
      // Faint spectrum behind the trace (log-spaced bins, ~40 Hz to ~12 kHz).
      a.getByteFrequencyData(freq)
      const nyq = a.context.sampleRate / 2
      const bw = w / BARS
      g.fillStyle = `rgba(${color}, 0.09)`
      for (let k = 0; k < BARS; k++) {
        const f0 = 40 * Math.pow(12000 / 40, k / BARS)
        const f1 = 40 * Math.pow(12000 / 40, (k + 1) / BARS)
        const i0 = Math.min(freq.length - 1, Math.floor((f0 / nyq) * freq.length))
        const i1 = Math.min(freq.length, Math.max(i0 + 1, Math.ceil((f1 / nyq) * freq.length)))
        let m = 0
        for (let i = i0; i < i1; i++) m = Math.max(m, freq[i])
        const bh = (m / 255) * h * 0.75
        if (bh > 0) g.fillRect(k * bw + bw * 0.15, h - bh, bw * 0.7, bh)
      }
      a.getByteTimeDomainData(wave)
      // Trigger on a rising zero crossing so the wave holds still.
      const n = wave.length >> 1
      let start = 0
      for (let i = 1; i < n; i++) {
        if (wave[i - 1] < 128 && wave[i] >= 128) {
          start = i
          break
        }
      }
      // Average each column's samples: smooth, but true to the signal.
      const per = n / N
      for (let i = 0; i < N; i++) {
        const s0 = start + Math.floor(i * per)
        const s1 = Math.max(s0 + 1, start + Math.floor((i + 1) * per))
        let sum = 0
        for (let j = s0; j < s1; j++) sum += wave[j]
        // Stations are mixed well below full scale: a fixed display gain (like a scope's V/div).
        ys[i] = Math.max(-1, Math.min(1, ((sum / (s1 - s0) - 128) / 128) * 1.8))
      }
      return true
    }

    // The envelope view lifts the trace above its loudness strip.
    const strip = source?.kind === 'envelope'
    const MID = strip ? 0.38 : 0.5
    const AMP = strip ? 0.5 : 0.4
    const path = (pts: Float32Array, w: number, h: number) => {
      g.beginPath()
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * w
        const y = Math.min(h, Math.max(0, h * MID - pts[i] * h * AMP))
        if (i) g.lineTo(x, y)
        else g.moveTo(x, y)
      }
    }

    const draw = () => {
      const dpr = fit()
      const { width: w, height: h } = canvas
      g.clearRect(0, 0, w, h)
      const t = running ? (frozenT.current = performance.now() / 1000) : frozenT.current
      const live = sample(w, h, dpr, t)

      // Ruler ticks along the bottom and left edges, faint center line.
      g.fillStyle = `rgba(${color}, 0.6)`
      for (let i = 1; i < 20; i++) {
        const big = i % 5 === 0
        g.fillRect((w * i) / 20, h - (big ? 10 : 5) * dpr, 1 * dpr, (big ? 10 : 5) * dpr)
      }
      for (let i = 1; i < 8; i++) {
        const big = i % 4 === 0
        g.fillRect(0, (h * i) / 8, (big ? 10 : 5) * dpr, 1 * dpr)
      }
      g.fillStyle = `rgba(${color}, 0.15)`
      g.fillRect(0, h * MID, w, 1 * dpr)
      if (!live) ys.fill(0)

      g.lineJoin = 'round'
      g.lineCap = 'round'
      // Phosphor afterglow: the previous frame, dim.
      if (ghost && running) {
        path(ghost, w, h)
        g.lineWidth = 1.5 * dpr
        g.strokeStyle = `rgba(${color}, 0.22)`
        g.stroke()
      }
      path(ys, w, h)
      // Wide soft halo, then the bright core.
      g.lineWidth = 6 * dpr
      g.strokeStyle = `rgba(${color}, 0.16)`
      g.stroke()
      g.lineWidth = 2 * dpr
      g.strokeStyle = `rgb(${color})`
      g.shadowColor = `rgba(${color}, 0.9)`
      g.shadowBlur = 10 * dpr
      g.stroke()
      g.shadowBlur = 0
      ghost = ghost && ghost.length === N ? (ghost.set(ys), ghost) : Float32Array.from(ys)

      if (running) raf = requestAnimationFrame(draw)
    }

    draw()
    // A still frame of live audio (reduced motion) taken right at tune-in would be flat: take one more.
    const later = !running && an ? window.setTimeout(draw, 700) : 0
    const ro = new ResizeObserver(() => !running && draw())
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(later)
      ro.disconnect()
    }
  }, [source, color, running])

  return <canvas ref={ref} aria-label="Signal waveform" role="img" />
}
