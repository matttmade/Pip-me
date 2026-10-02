import { useEffectsConfig } from '../effects/EffectsProvider'
import { triggerGlitch } from '../effects/glitchScheduler'
import { HUES } from '../effects/presets'
import type { PresetName } from '../effects/types'
import { useSettings } from '../lib/profile'
import { FINISHES, useDeviceSettings } from './deviceSettings'
import { Knob } from './Knob'
import { PipMeLogo } from './PipMeLogo'

const SIGNAL: PresetName[] = ['OFF', 'SUBTLE', 'CLASSIC', 'DAMAGED']
const SIGNAL_STOPS = SIGNAL.map((p, i) => ({ value: i, label: p }))

export function ControlPanel({ warp, onDegauss, knobSize }: { warp: boolean; onDegauss: () => void; knobSize: number }) {
  const [cfg, update] = useEffectsConfig()
  const [settings, setSettings] = useSettings()
  const [device, setDevice] = useDeviceSettings()
  const signal = Math.max(0, SIGNAL.indexOf(cfg.preset))

  // TUNING snaps gently to the named phosphors when close
  const tune = (hue: number) => {
    const near = Object.values(HUES).find((h) => Math.abs(h - hue) <= 4)
    update({ hue: near ?? Math.round(hue) })
  }

  return (
    <div className="ctl">
      <div className="ctl__plate">
        <PipMeLogo variant="emboss" />
        <span className="ctl__model">MODEL 3000 · PERSONAL INFORMATION PROCESSOR</span>
      </div>

      <div className="ctl__knobs">
        <Knob label="TUNING" value={cfg.hue} min={0} max={360} step={1} onChange={tune} format={(v) => `${Math.round(v)}°`} size={knobSize} />
        <Knob
          label="SIGNAL"
          value={cfg.preset === 'CUSTOM' ? -1 : signal}
          min={0}
          max={3}
          stops={SIGNAL_STOPS}
          onChange={(i) => update({ preset: SIGNAL[i] })}
          size={knobSize}
        />
        <Knob label="BRIGHT" value={cfg.glow} min={0} max={1} step={0.02} onChange={(glow) => update({ glow })} format={(v) => `${Math.round(v * 100)}%`} size={knobSize} />
        <Knob
          label="VOLUME"
          value={settings.volume}
          min={0}
          max={1}
          step={0.02}
          onChange={(volume) => setSettings({ ...settings, volume })}
          format={(v) => `${Math.round(v * 100)}%`}
          size={knobSize}
        />
      </div>

      <div className="ctl__switches">
        <Toggle label="SOUND" on={settings.sound} onChange={(sound) => setSettings({ ...settings, sound })} />
        <Toggle label="CURVE" on={warp} onChange={(w) => setDevice({ ...device, warp: w })} />
        <button
          className="ctl__push"
          onClick={() => {
            triggerGlitch(1, { force: true })
            onDegauss()
          }}
        >
          <span className="ctl__push-cap" />
          <span className="ctl__cap-label">DEGAUSS</span>
        </button>
      </div>

      <div className="ctl__finish" role="radiogroup" aria-label="Casing finish">
        {FINISHES.map((f) => (
          <button
            key={f}
            role="radio"
            aria-checked={device.finish === f}
            aria-label={`${f} finish`}
            className={`ctl__chip ctl__chip--${f.toLowerCase()}${device.finish === f ? ' is-active' : ''}`}
            onClick={() => setDevice({ ...device, finish: f })}
          />
        ))}
        <span className="ctl__cap-label">FINISH</span>
      </div>
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button className={`ctl__toggle${on ? ' is-on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}>
      <span className="ctl__led" />
      <span className="ctl__lever">
        <span />
      </span>
      <span className="ctl__cap-label">{label}</span>
    </button>
  )
}
