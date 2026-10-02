import { useId } from 'react'

type Props = {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  format?: (v: number) => string
  disabled?: boolean
}

/** Bracketed segmented bar over a native range input (keyboard + screen reader friendly). */
export function PipSlider({ label, value, min, max, step = 0.01, onChange, format, disabled }: Props) {
  const id = useId()
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={`pip-slider${disabled ? ' is-disabled' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <span className="pip-slider__track" style={{ '--pct': `${pct}%` } as React.CSSProperties}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </span>
      <output htmlFor={id}>{format ? format(value) : value.toFixed(2)}</output>
    </div>
  )
}
