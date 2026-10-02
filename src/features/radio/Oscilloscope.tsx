import { useEffect, useRef } from 'react'

type Props = {
  analyser: AnalyserNode | null
  /** "r, g, b" of the current Pip hue. */
  color: string
  /** Animate only while audible and the page is visible; otherwise draw one idle frame. */
  running: boolean
  /** Draw a synthetic trace instead of reading the analyser: (x 0-1, t seconds) -> -1..1. */
  simulate?: (x: number, t: number) => number
}

/** Pip-Boy style waveform: tick ruler on the axes, glowing trace from an AnalyserNode. */
export function Oscilloscope({ analyser, color, running, simulate }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const g = canvas?.getContext('2d')
    if (!canvas || !g) return
    const data = new Uint8Array(analyser?.fftSize ?? 2048)
    let raf = 0

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      return dpr
    }

    const draw = () => {
      const dpr = fit()
      const { width: w, height: h } = canvas
      g.clearRect(0, 0, w, h)

      // Ruler ticks along the bottom and left edges.
      g.fillStyle = `rgba(${color}, 0.6)`
      const ticks = 20
      for (let i = 1; i < ticks; i++) {
        const x = (w * i) / ticks
        const big = i % 5 === 0
        g.fillRect(x, h - (big ? 10 : 5) * dpr, 1 * dpr, (big ? 10 : 5) * dpr)
      }
      for (let i = 1; i < 8; i++) {
        const y = (h * i) / 8
        const big = i % 4 === 0
        g.fillRect(0, y, (big ? 10 : 5) * dpr, 1 * dpr)
      }
      // Faint center line.
      g.fillStyle = `rgba(${color}, 0.15)`
      g.fillRect(0, h / 2, w, 1 * dpr)

      // Trace.
      g.lineWidth = 2 * dpr
      g.strokeStyle = `rgb(${color})`
      g.shadowColor = `rgba(${color}, 0.9)`
      g.shadowBlur = 10 * dpr
      g.beginPath()
      if (simulate) {
        // Static frame when not running (e.g. reduced motion); animated otherwise.
        const t = running ? performance.now() / 1000 : 1.7
        const n = 240
        for (let i = 0; i < n; i++) {
          const x = (i / (n - 1)) * w
          const y = h / 2 - simulate(i / (n - 1), t) * h * 0.38
          if (i) g.lineTo(x, y)
          else g.moveTo(x, y)
        }
      } else if (analyser && running) {
        analyser.getByteTimeDomainData(data)
        // Start at a rising zero crossing so the wave holds still.
        let start = 0
        for (let i = 1; i < data.length / 2; i++) {
          if (data[i - 1] < 128 && data[i] >= 128) {
            start = i
            break
          }
        }
        const n = Math.floor(data.length / 2)
        for (let i = 0; i < n; i++) {
          const v = (data[start + i] - 128) / 128
          const x = (i / (n - 1)) * w
          const y = h / 2 - v * h * 0.42
          if (i) g.lineTo(x, y)
          else g.moveTo(x, y)
        }
      } else {
        g.moveTo(0, h / 2)
        g.lineTo(w, h / 2)
      }
      g.stroke()
      g.shadowBlur = 0

      if (running) raf = requestAnimationFrame(draw)
    }

    draw()
    const ro = new ResizeObserver(() => !running && draw())
    ro.observe(canvas)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [analyser, color, running, simulate])

  return <canvas ref={ref} aria-label="Signal waveform" role="img" />
}
