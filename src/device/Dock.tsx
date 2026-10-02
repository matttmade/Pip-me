import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useEffectsConfig } from '../effects/EffectsProvider'
import { triggerGlitch } from '../effects/glitchScheduler'
import { HUES } from '../effects/presets'
import type { PresetName } from '../effects/types'
import { useSettings } from '../lib/profile'
import type { View } from './deviceSettings'

const COLORS: [string, number][] = [
  ['Green', HUES.GREEN],
  ['Amber', HUES.AMBER],
  ['Blue', HUES.BLUE],
  ['Teal', HUES.TEAL],
  ['LCD', HUES.LCD],
]
const SIGNALS: PresetName[] = ['OFF', 'SUBTLE', 'CLASSIC', 'DAMAGED']
const label = (p: string) => p.charAt(0) + p.slice(1).toLowerCase()

type Pop = 'sound' | 'color' | 'signal' | null

/** Floating "liquid glass" action bar: view, sound, color, signal, degauss, fullscreen. */
export function Dock({ view, onView, onDegauss }: { view: View; onView: (v: View) => void; onDegauss: () => void }) {
  const [cfg, update] = useEffectsConfig()
  const [settings, setSettings] = useSettings()
  const [pop, setPop] = useState<Pop>(null)
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement)
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setPop(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null)
    document.addEventListener('fullscreenchange', onFs)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const toggle = (p: Pop) => setPop((cur) => (cur === p ? null : p))
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())

  return (
    <div className="dock" ref={ref} role="toolbar" aria-label="Pip-Me controls">
      <div className="dock__seg" role="radiogroup" aria-label="View">
        <button role="radio" aria-checked={view === 'screen'} className={`dock__segbtn${view === 'screen' ? ' is-on' : ''}`} onClick={() => onView('screen')}>
          <Icon d="M4 6h16v11H4z M9 20h6" /> Screen
        </button>
        <button role="radio" aria-checked={view === 'arm'} className={`dock__segbtn${view === 'arm' ? ' is-on' : ''}`} onClick={() => onView('arm')}>
          <Icon d="M7 7h10v10H7z M9 4h6 M9 20h6 M17 10h2v4h-2" /> On arm
        </button>
      </div>
      <span className="dock__sep" aria-hidden />

      <DockItem
        label={settings.sound ? 'Sound on' : 'Sound off'}
        active={pop === 'sound'}
        onClick={() => toggle('sound')}
        icon={settings.sound ? 'M4 10h4l5-4v12l-5-4H4z M16 9a4 4 0 0 1 0 6 M18.5 6.5a7.5 7.5 0 0 1 0 11' : 'M4 10h4l5-4v12l-5-4H4z M16 9l5 6 M21 9l-5 6'}
      >
        {pop === 'sound' && (
          <div className="dock__pop" role="dialog" aria-label="Sound">
            <button className={`dock__chip${settings.sound ? ' is-on' : ''}`} onClick={() => setSettings({ ...settings, sound: !settings.sound })}>
              {settings.sound ? 'Sound on' : 'Sound off'}
            </button>
            <label className="dock__range">
              <span>Volume</span>
              <input type="range" min={0} max={1} step={0.02} value={settings.volume} onChange={(e) => setSettings({ ...settings, volume: Number(e.target.value) })} />
              <output>{Math.round(settings.volume * 100)}%</output>
            </label>
          </div>
        )}
      </DockItem>

      <DockItem label="Color" active={pop === 'color'} onClick={() => toggle('color')} swatch={cfg.hue}>
        {pop === 'color' && (
          <div className="dock__pop dock__pop--row" role="dialog" aria-label="Screen color">
            {COLORS.map(([name, hue]) => (
              <button
                key={name}
                className={`dock__swatch${cfg.hue === hue ? ' is-on' : ''}`}
                style={{ '--sw': `hsl(${hue} 100% 55%)` } as React.CSSProperties}
                onClick={() => update({ hue })}
                aria-label={name}
                title={name}
              />
            ))}
          </div>
        )}
      </DockItem>

      <DockItem label={`Signal: ${label(cfg.preset)}`} active={pop === 'signal'} onClick={() => toggle('signal')} icon="M3 12h3l2-6 4 12 3-9 2 3h4">
        {pop === 'signal' && (
          <div className="dock__pop" role="dialog" aria-label="Screen effects">
            {SIGNALS.map((p) => (
              <button key={p} className={`dock__chip${cfg.preset === p ? ' is-on' : ''}`} onClick={() => update({ preset: p })}>
                {label(p)}
              </button>
            ))}
          </div>
        )}
      </DockItem>

      <DockItem
        label="Degauss"
        onClick={() => {
          triggerGlitch(1, { force: true })
          onDegauss()
        }}
        icon="M13 3 5 14h6l-1 7 8-11h-6z"
      />
      <DockItem label={full ? 'Exit full screen' : 'Full screen'} onClick={fullscreen} icon={full ? 'M9 4v5H4 M15 4v5h5 M9 20v-5H4 M15 20v-5h5' : 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5'} />
    </div>
  )
}

function DockItem({
  label,
  icon,
  swatch,
  active,
  onClick,
  children,
}: {
  label: string
  icon?: string
  swatch?: number
  active?: boolean
  onClick: () => void
  children?: ReactNode
}) {
  return (
    <div className="dock__item">
      <button className={`dock__btn${active ? ' is-on' : ''}`} onClick={onClick} aria-label={label} aria-expanded={children !== undefined ? active : undefined} data-tip={label}>
        {icon && <Icon d={icon} />}
        {swatch !== undefined && <span className="dock__dot" style={{ background: `hsl(${swatch} 100% 55%)` }} />}
      </button>
      {children}
    </div>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg className="dock__icon" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
