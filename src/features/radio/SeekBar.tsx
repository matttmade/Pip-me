import { useRef, useState } from 'react'
import { formatHMS, positionAt, progress, seekForKey, seekText } from './transport'

type Props = {
  position: number
  duration: number
  onSeek: (ms: number) => void
  disabled?: boolean
}

/** Segmented Pip-Boy progress bar that scrubs with pointer drag and arrow/Page/Home/End keys. */
export function SeekBar({ position, duration, onSeek, disabled }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const off = disabled || !(duration > 0)
  const shown = drag ?? position

  const at = (clientX: number) => {
    const r = track.current?.getBoundingClientRect()
    return r ? positionAt(clientX, r.left, r.width, duration) : 0
  }

  return (
    <div className={`radio-seek${off ? ' is-disabled' : ''}${drag != null ? ' is-dragging' : ''}`} data-no-swipe>
      <span className="radio-seek__time">{off ? '--:--' : formatHMS(shown, duration)}</span>
      <div
        ref={track}
        className="radio-seek__bar"
        role="slider"
        tabIndex={off ? -1 : 0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration / 1000)}
        aria-valuenow={Math.round(shown / 1000)}
        aria-valuetext={seekText(shown, duration)}
        aria-disabled={off || undefined}
        style={{ '--pct-n': progress(shown, duration) } as React.CSSProperties}
        onPointerDown={(e) => {
          if (off || e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          setDrag(at(e.clientX))
        }}
        onPointerMove={(e) => drag != null && setDrag(at(e.clientX))}
        onPointerUp={(e) => {
          if (drag == null) return
          const v = at(e.clientX)
          setDrag(null)
          onSeek(v)
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.stopPropagation() // not "activate the selected station"
          if (off) return
          const v = seekForKey(e.key, position, duration)
          if (v == null) return
          // Keep list navigation (Up/Down) and tab keys from also firing.
          e.preventDefault()
          e.stopPropagation()
          onSeek(v)
        }}
      >
        <span className="radio-seek__fill" />
        <span className="radio-seek__head" />
      </div>
      <span className="radio-seek__time radio-seek__time--total">{off ? '--:--' : formatHMS(duration, duration)}</span>
    </div>
  )
}
