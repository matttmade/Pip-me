import { useCallback, useRef, type KeyboardEvent, type PointerEvent } from 'react'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Snap positions (rotary selector). When set, the knob clicks between them. */
  stops?: { value: number; label: string }[]
  onChange: (v: number) => void
  format?: (v: number) => string
  size?: number
}

const SWEEP = 270 // degrees of travel, -135..+135

/** A physical rotary knob: drag (circular or vertical), wheel, or arrow keys. */
export function Knob({ label, value, min, max, step = (max - min) / 100, stops, onChange, format, size = 64 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ lastAngle: number; lastY: number; acc: number } | null>(null)
  const t = (value - min) / (max - min)
  const angle = -SWEEP / 2 + t * SWEEP

  const commit = useCallback(
    (raw: number) => {
      let v = Math.min(max, Math.max(min, raw))
      if (stops?.length) v = stops.reduce((a, s) => (Math.abs(s.value - v) < Math.abs(a - v) ? s.value : a), stops[0].value)
      else v = Math.round(v / step) * step
      if (v !== value) onChange(v)
    },
    [min, max, step, stops, value, onChange],
  )

  const pointerAngle = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI
  }

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    ref.current?.setPointerCapture(e.pointerId)
    ref.current?.focus()
    drag.current = { lastAngle: pointerAngle(e), lastY: e.clientY, acc: value }
  }
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    const r = ref.current!.getBoundingClientRect()
    const dist = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
    const a = pointerAngle(e)
    let da = a - d.lastAngle
    if (da > 180) da -= 360
    if (da < -180) da += 360
    // circular drag around the knob; vertical drag when the pointer is near its center
    const delta = dist > r.width * 0.3 ? da / SWEEP : (d.lastY - e.clientY) / 200
    d.acc = Math.min(max, Math.max(min, d.acc + delta * (max - min)))
    d.lastAngle = a
    d.lastY = e.clientY
    commit(d.acc)
  }
  const onPointerUp = () => (drag.current = null)

  const nudge = (dir: number, big = false) => {
    if (stops?.length) {
      const i = stops.findIndex((s) => s.value === value)
      const next = stops[Math.min(stops.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))]
      if (next.value !== value) onChange(next.value)
    } else commit(value + dir * step * (big ? 10 : 1))
  }
  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 1, PageDown: -1 }
    if (e.key in map) {
      e.preventDefault()
      e.stopPropagation()
      nudge(map[e.key], e.key.startsWith('Page'))
    }
  }

  const text = stops?.find((s) => s.value === value)?.label ?? (format ? format(value) : String(Math.round(value)))

  return (
    <div className="knob" style={{ '--size': `${size}px` } as React.CSSProperties}>
      <div className="knob__dial">
        <div className="knob__ticks" aria-hidden>
          {(stops ?? Array.from({ length: 11 }, (_, i) => ({ value: min + (i / 10) * (max - min), label: '' }))).map((s, i) => (
            <span key={i} style={{ transform: `rotate(${-SWEEP / 2 + ((s.value - min) / (max - min)) * SWEEP}deg)` }} />
          ))}
        </div>
        <div
          ref={ref}
          className="knob__body"
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={text}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKey}
          onWheel={(e) => nudge(e.deltaY < 0 ? 1 : -1)}
        >
          <div className="knob__rotor" style={{ transform: `rotate(${angle}deg)` }}>
            <div className="knob__cap" />
            <div className="knob__mark" />
          </div>
          <div className="knob__specular" aria-hidden />
        </div>
      </div>
      <div className="knob__label">{label}</div>
      <div className="knob__value">{text}</div>
    </div>
  )
}
