import { useState } from 'react'
import { DisplayReadout } from '../device/DisplayReadout'
import { useEffectsConfig } from '../effects/EffectsProvider'
import { triggerGlitch } from '../effects/glitchScheduler'
import { useDeviceSettings, useView, warpAutoDefault } from '../device/deviceSettings'
import { HUES } from '../effects/presets'
import type { PresetName } from '../effects/types'
import { useProfile, useSettings } from '../lib/profile'
import { resetAll, useStored } from '../lib/store'
import { PRESETS_KEY, type SavedPreset } from '../lib/systemPresets'
import { ListDetail, type ListItem } from '../shell/ListDetail'
import { SavedPresets } from './SavedPresets'
import { requestInstallPrompt } from '../features/install/installStore'
import { DEFAULT_DETAIL, DETAIL_KEY, DETAIL_LEVELS, normalizeDetail, type DetailLevel } from '../features/dweller/fidelity'
import { DEFAULT_FIGURE, FIGURE_KEY, FIGURE_LABEL, FIGURES, normalizeFigure, type Figure } from '../features/dweller/vaultboy/behavior'
import { PipSlider } from '../shell/PipSlider'
import { PipToggle } from '../shell/PipToggle'

const pct = (v: number) => `${Math.round(v * 100)}%`
const PRESETS: PresetName[] = ['PIP-ME', 'OFF', 'SUBTLE', 'CLASSIC', 'DAMAGED']
const COLORS: [string, number][] = [
  ['GREEN', HUES.GREEN],
  ['AMBER', HUES.AMBER],
  ['BLUE', HUES.BLUE],
  ['TEAL', HUES.TEAL],
  ['LCD', HUES.LCD],
]

export function SystemPanel() {
  const [cfg, update] = useEffectsConfig()
  const [profile, setProfile] = useProfile()
  const [settings, setSettings] = useSettings()
  const [selected, setSelected] = useStored('system:selected', 'PRESET')
  const [confirmReset, setConfirmReset] = useState(false)
  const [device, setDevice] = useDeviceSettings()
  const [view, setView] = useView()
  const [saved] = useStored<SavedPreset[]>(PRESETS_KEY, [])
  const [storedFigure, setFigure] = useStored<Figure>(FIGURE_KEY, DEFAULT_FIGURE)
  const figure = normalizeFigure(storedFigure)
  const [storedDetail, setDetail] = useStored<DetailLevel>(DETAIL_KEY, DEFAULT_DETAIL)
  const dwellerDetail = normalizeDetail(storedDetail)
  const warp = device.warp ?? warpAutoDefault()

  const onOff = (on: boolean) => (on ? 'ON' : 'OFF')
  const items: ListItem[] = [
    { id: 'SAVED', label: 'SAVED PRESETS', right: saved.length || '' },
    { id: 'PRESET', label: 'DISPLAY PRESET', right: cfg.preset },
    { id: 'SCANLINES', label: 'SCANLINES', right: onOff(cfg.scanlines.on) },
    { id: 'NOISE', label: 'NOISE', right: onOff(cfg.noise.on) },
    { id: 'GLITCH', label: 'GLITCH', right: onOff(cfg.glitch.on) },
    { id: 'FLICKER', label: 'FLICKER', right: onOff(cfg.flicker.on) },
    { id: 'ROLL', label: 'ROLL BAR', right: onOff(cfg.rollBar.on) },
    { id: 'SCREEN', label: 'GLOW + SCREEN' },
    { id: 'COLOR', label: 'PHOSPHOR COLOR', right: cfg.hue },
    { id: 'DEVICE', label: 'DEVICE + CRT', right: view === 'arm' ? 'ON ARM' : 'SCREEN' },
    { id: 'FIGURE', label: 'STATUS FIGURE', right: FIGURE_LABEL[figure] },
    { id: 'IDENTITY', label: 'DWELLER ID' },
    { id: 'PREFS', label: 'PREFERENCES' },
    { id: 'ABOUT', label: 'ABOUT / LEGAL' },
    { id: 'RESET', label: 'RESET TERMINAL' },
  ]

  const detail = (() => {
    switch (selected) {
      case 'SAVED':
        return (
          <Detail title="SAVED PRESETS" note="A preset stores display effects, color, device and preferences (not your name or quests). Saved presets stay in this browser after it closes and survive RESET TERMINAL.">
            <SavedPresets />
          </Detail>
        )
      case 'PRESET':
        return (
          <Detail title="DISPLAY PRESET" note="Editing any effect switches the preset to CUSTOM.">
            <div className="pip-choices">
              {PRESETS.map((p) => (
                <button key={p} className={`pip-btn${cfg.preset === p ? ' is-active' : ''}`} onClick={() => update({ preset: p })}>
                  {p}
                </button>
              ))}
              {cfg.preset === 'CUSTOM' && <span className="pip-btn is-active">CUSTOM</span>}
            </div>
            <TestGlitch />
          </Detail>
        )
      case 'SCANLINES':
        return (
          <Detail title="SCANLINES">
            <PipToggle label="SCANLINES" on={cfg.scanlines.on} onChange={(on) => update({ scanlines: { on } })} />
            <PipSlider label="OPACITY" value={cfg.scanlines.opacity} min={0} max={0.6} onChange={(opacity) => update({ scanlines: { opacity } })} format={pct} />
            <PipSlider label="DENSITY" value={cfg.scanlines.density} min={2} max={8} step={1} onChange={(density) => update({ scanlines: { density } })} format={(v) => `${v}PX`} />
            <PipSlider label="DRIFT" value={cfg.scanlines.speed} min={0} max={40} step={1} onChange={(speed) => update({ scanlines: { speed } })} format={(v) => `${v}PX/S`} />
          </Detail>
        )
      case 'NOISE':
        return (
          <Detail title="BACKGROUND NOISE">
            <PipToggle label="NOISE" on={cfg.noise.on} onChange={(on) => update({ noise: { on } })} />
            <PipSlider label="AMOUNT" value={cfg.noise.amount} min={0} max={0.3} onChange={(amount) => update({ noise: { amount } })} format={pct} />
            <PipSlider label="FRAME RATE" value={cfg.noise.fps} min={0} max={30} step={1} onChange={(fps) => update({ noise: { fps } })} format={(v) => (v ? `${v} FPS` : 'STATIC')} />
          </Detail>
        )
      case 'GLITCH':
        return (
          <Detail title="SIGNAL GLITCH">
            <PipToggle label="GLITCH" on={cfg.glitch.on} onChange={(on) => update({ glitch: { on } })} />
            <PipSlider label="INTERVAL" value={cfg.glitch.frequency} min={1} max={30} step={1} onChange={(frequency) => update({ glitch: { frequency } })} format={(v) => `~${v}S`} />
            <PipSlider label="STRENGTH" value={cfg.glitch.strength} min={0} max={1} onChange={(strength) => update({ glitch: { strength } })} format={pct} />
            <PipToggle label="RGB SPLIT" on={cfg.glitch.rgbSplit} onChange={(rgbSplit) => update({ glitch: { rgbSplit } })} />
            <TestGlitch />
          </Detail>
        )
      case 'FLICKER':
        return (
          <Detail title="FLICKER">
            <PipToggle label="FLICKER" on={cfg.flicker.on} onChange={(on) => update({ flicker: { on } })} />
            <PipSlider label="AMOUNT" value={cfg.flicker.amount} min={0} max={0.1} step={0.005} onChange={(amount) => update({ flicker: { amount } })} format={pct} />
          </Detail>
        )
      case 'ROLL':
        return (
          <Detail title="ROLL BAR">
            <PipToggle label="ROLL BAR" on={cfg.rollBar.on} onChange={(on) => update({ rollBar: { on } })} />
            <PipSlider label="INTERVAL" value={cfg.rollBar.interval} min={2} max={20} step={1} onChange={(interval) => update({ rollBar: { interval } })} format={(v) => `${v}S`} />
          </Detail>
        )
      case 'SCREEN':
        return (
          <Detail title="GLOW + SCREEN">
            <PipSlider label="GLOW" value={cfg.glow} min={0} max={1} onChange={(glow) => update({ glow })} format={pct} />
            <PipSlider label="VIGNETTE" value={cfg.vignette} min={0} max={1} onChange={(vignette) => update({ vignette })} format={pct} />
            <PipSlider label="CURVATURE" value={cfg.curvature} min={0} max={1} onChange={(curvature) => update({ curvature })} format={pct} />
          </Detail>
        )
      case 'COLOR':
        return (
          <Detail title="PHOSPHOR COLOR">
            <div className="pip-choices">
              {COLORS.map(([name, hue]) => (
                <button key={name} className={`pip-btn${cfg.hue === hue ? ' is-active' : ''}`} onClick={() => update({ hue })}>
                  {name}
                </button>
              ))}
            </div>
            <PipSlider label="HUE" value={cfg.hue} min={0} max={360} step={1} onChange={(hue) => update({ hue })} format={(v) => `${v}°`} />
          </Detail>
        )
      case 'DEVICE':
        return (
          <Detail title="DEVICE + CRT" note="ON ARM and SCREEN apply on larger displays; phones always show the screen. Curvature uses a live displacement filter, off by default on phones and Safari to save battery.">
            <div className="pip-choices">
              {(['arm', 'screen'] as const).map((v) => (
                <button key={v} className={`pip-btn${view === v ? ' is-active' : ''}`} onClick={() => setView(v)}>
                  {v === 'arm' ? 'ON ARM' : 'SCREEN'}
                </button>
              ))}
            </div>
            <button className="pip-btn" onClick={requestInstallPrompt}>
              [ ADD TO HOME SCREEN ]
            </button>
            <DisplayReadout />
            <PipToggle label="CRT WARP" on={warp} onChange={(w) => setDevice({ ...device, warp: w })} />
            <PipToggle label="PIP CURSOR" on={device.cursor !== false} onChange={(cursor) => setDevice({ ...device, cursor })} />
            <PipSlider label="CURVATURE" value={cfg.curvature} min={0} max={1} onChange={(curvature) => update({ curvature })} format={pct} />
          </Detail>
        )
      case 'FIGURE':
        return (
          <Detail title="STATUS FIGURE" note="VAULT BOY is the fan rig supplied by the project owner. DWELLER is the original procedural figure; DETAIL sets how it is drawn.">
            <div className="pip-choices">
              {FIGURES.map((f) => (
                <button key={f} className={`pip-btn${figure === f ? ' is-active' : ''}`} onClick={() => setFigure(f)}>
                  {FIGURE_LABEL[f]}
                </button>
              ))}
            </div>
            {figure === 'DWELLER' && (
              <div className="pip-choices" role="group" aria-label="Dweller detail">
                {DETAIL_LEVELS.map((l) => (
                  <button key={l} className={`pip-btn${dwellerDetail === l ? ' is-active' : ''}`} onClick={() => setDetail(l)}>
                    {l}
                  </button>
                ))}
              </div>
            )}
          </Detail>
        )
      case 'ABOUT':
        return (
          <Detail title="ABOUT / LEGAL">
            <p className="pip-note">
              Pip-Me is an unofficial fan-made case study. Not affiliated with or endorsed by Bethesda Softworks, ZeniMax or Microsoft.
              Fallout, Pip-Boy and Vault-Tec are trademarks of their respective owners. Non-commercial: no ads, no accounts, no tracking.
            </p>
            <p className="pip-note">Your settings and quests stay in this browser session. Map tiles, weather and place names come from OpenFreeMap, Open-Meteo and Nominatim; Appalachia Radio streams from SoundCloud.</p>
          </Detail>
        )
      case 'IDENTITY':
        return (
          <Detail title="DWELLER ID">
            <label className="pip-field">
              <span>NAME</span>
              <input value={profile.name} maxLength={24} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </label>
            <label className="pip-field">
              <span>VAULT NO.</span>
              <input
                value={profile.vault}
                maxLength={3}
                inputMode="numeric"
                onChange={(e) => setProfile({ ...profile, vault: e.target.value.replace(/\D/g, '') })}
              />
            </label>
          </Detail>
        )
      case 'PREFS':
        return (
          <Detail title="PREFERENCES">
            <div className="pip-choices">
              {(['F', 'C'] as const).map((u) => (
                <button key={u} className={`pip-btn${settings.units === u ? ' is-active' : ''}`} onClick={() => setSettings({ ...settings, units: u })}>
                  °{u}
                </button>
              ))}
            </div>
            <PipToggle label="WASTELAND DATE" on={settings.wastelandDate} onChange={(wastelandDate) => setSettings({ ...settings, wastelandDate })} />
            <PipToggle label="SOUND" on={settings.sound} onChange={(sound) => setSettings({ ...settings, sound })} />
            <PipSlider label="VOLUME" value={settings.volume} min={0} max={1} onChange={(volume) => setSettings({ ...settings, volume })} format={pct} disabled={!settings.sound} />
          </Detail>
        )
      default:
        return (
          <Detail title="RESET TERMINAL" note="Clears every customization, quest and holotape stored in this browser session. Saved presets are kept.">
            <button
              className={`pip-btn pip-btn--danger${confirmReset ? ' is-active' : ''}`}
              onClick={() => {
                if (!confirmReset) return setConfirmReset(true)
                resetAll()
                window.location.reload()
              }}
            >
              {confirmReset ? '[ PRESS AGAIN TO CONFIRM ]' : '[ RESET TERMINAL ]'}
            </button>
          </Detail>
        )
    }
  })()

  return <ListDetail label="System settings" items={items} selected={selected} onSelect={(id) => (setSelected(id), setConfirmReset(false))} detail={detail} />
}

function Detail({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="system-detail pip-frame">
      <h2 className="pip-frame__title">{title}</h2>
      {children}
      {note && <p className="pip-note">{note}</p>}
    </div>
  )
}

function TestGlitch() {
  return (
    <button className="pip-btn" onClick={() => triggerGlitch(0.7, { force: true })}>
      [ TEST GLITCH ]
    </button>
  )
}
