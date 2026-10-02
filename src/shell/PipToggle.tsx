type Props = { label: string; on: boolean; onChange: (on: boolean) => void }

export function PipToggle({ label, on, onChange }: Props) {
  return (
    <button type="button" role="switch" aria-checked={on} className="pip-toggle" onClick={() => onChange(!on)}>
      <span className="pip-toggle__box">{on ? '■' : ' '}</span>
      <span>{label}</span>
      <span className="pip-toggle__state">{on ? 'ON' : 'OFF'}</span>
    </button>
  )
}
