import { useMemo } from 'react'
import { pipRgb, useEffectsConfig, usePageVisible, usePrefersReducedMotion, useSettings, useStored } from '../../lib/contracts'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { radio, scPlayhead, useRadio } from './engine'
import { Oscilloscope, type ScopeSource } from './Oscilloscope'
import { OFF, type ScStatus } from './radioState'
import { ScTransport } from './ScTransport'
import { APPALACHIA_ID, APPALACHIA_STATION, simulatedSignal } from './soundcloud'
import { STATIONS, YOUR_STATION } from './stations'

const pct = (v: number) => `${Math.round(v * 100)}%`
const SC_STATUS: Record<ScStatus, string> = {
  loading: 'LOADING SIGNAL…',
  ready: 'PAUSED',
  playing: 'ON AIR',
  lost: 'SIGNAL LOST',
}

/** Station list as shown: the streamed station first, then the procedural ones. */
const LISTED = [APPALACHIA_STATION, ...STATIONS]

/**
 * View/controller of the persistent radio engine. Playback lives in engine.ts and
 * RadioHost, so unmounting this panel (switching tabs) never stops the audio.
 */
export default function RadioPanel() {
  const [settings, setSettings] = useSettings()
  const [cfg] = useEffectsConfig()
  const visible = usePageVisible()
  const reducedMotion = usePrefersReducedMotion()
  const [selected, setSelected] = useStored('radio:selected', APPALACHIA_ID)
  const { station: active, sc, file, analyser } = useRadio()
  const muted = !settings.sound
  const scStatus = sc.status
  const tune = (id: string) => {
    if (!muted) radio.tune(id)
  }

  const onFile = (f: File | undefined) => {
    if (!f || muted) return
    setSelected(YOUR_STATION)
    radio.loadFile(f)
  }

  const items: ListItem[] = [
    ...LISTED.map((s) => ({ id: s.id, label: s.name, right: active === s.id ? '■' : undefined })),
    { id: YOUR_STATION, label: 'YOUR STATION', right: active === YOUR_STATION ? '■' : undefined },
    { id: OFF, label: 'RADIO OFF', right: active ? undefined : '■' },
  ]

  const station = LISTED.find((s) => s.id === selected)
  const isSc = selected === APPALACHIA_ID
  const scOn = active === APPALACHIA_ID
  const isYours = selected === YOUR_STATION
  const isOff = selected === OFF
  const on = active != null && active === selected
  const [r, g, b] = pipRgb(cfg.hue)
  const scLive = scOn && scStatus === 'playing'
  const scHeld = scOn && (scStatus === 'playing' || scStatus === 'ready')
  const scVolume = sc.muted ? 0 : settings.volume
  // The trace's height follows what you'd hear; paused, it freezes in place.
  const scGain = 0.12 + 0.88 * Math.min(1, scVolume * 1.4)
  const envelope = sc.envelope
  const scDuration = sc.duration
  const scSource = useMemo<ScopeSource>(
    () =>
      envelope && scDuration > 0
        ? { kind: 'envelope', envelope, duration: scDuration, gain: scGain, playhead: scPlayhead }
        : { kind: 'sim', fn: (x, t) => simulatedSignal(x, t, scGain) },
    [envelope, scDuration, scGain],
  )
  const synthSource = useMemo<ScopeSource | null>(() => (analyser ? { kind: 'analyser', analyser } : null), [analyser])
  const source = scOn ? (scHeld ? scSource : null) : active ? synthSource : null
  const scopeTag = scOn ? (scSource.kind === 'envelope' ? 'WAVEFORM // SOUNDCLOUD ENVELOPE' : 'SIGNAL SIMULATED') : active ? 'WAVEFORM // LIVE AUDIO' : null

  const detail = (
    <div className={`radio-detail pip-frame${isSc ? ' radio-detail--sc' : ''}`}>
      <h2 className="pip-frame__title">
        <span>{isOff ? 'RADIO OFF' : isYours ? 'YOUR STATION' : station?.name}</span>
        <small className="pip-frame__aside">{isOff ? '--.-' : isYours ? 'LOCAL' : `${station?.freq} MHZ`}</small>
      </h2>
      <div className="radio-scope" data-no-swipe>
        <Oscilloscope source={source} color={`${r}, ${g}, ${b}`} running={visible && !reducedMotion && (scOn ? scLive : active != null)} />
        {scopeTag && <span className="radio-scope__tag">{scopeTag}</span>}
      </div>
      {muted ? (
        <p className="radio-warn">
          AUDIO DISABLED IN SYSTEM.
          <br />
          <span className="pip-note">Turn SOUND on in DATA &gt; SYSTEM &gt; PREFERENCES.</span>
        </p>
      ) : (
        <div className="radio-status" role="status">
          <span className={on && (!isSc || scLive) ? 'is-live' : undefined}>
            {on ? (isSc ? SC_STATUS[scStatus] : 'SIGNAL LOCKED') : active ? 'TUNED ELSEWHERE' : 'NO SIGNAL'}
          </span>
          {isSc ? (
            <span className="radio-status__tags">
              <span className="radio-tag" aria-label="Loop is always on">
                ↻ LOOP
              </span>
            </span>
          ) : (
            <span>VOL {pct(settings.volume)}</span>
          )}
        </div>
      )}
      {isSc && on && scStatus === 'lost' && (
        <div className="radio-warn radio-warn--row">
          <span>The stream could not be reached: you may be offline, or SoundCloud is blocked on this network.</span>
          <button className="pip-btn" onClick={radio.retry}>
            [ RETRY ]
          </button>
        </div>
      )}
      {isSc && !muted && (
        <ScTransport
          tuned={scOn}
          status={scStatus}
          position={sc.position}
          duration={sc.duration}
          volume={settings.volume}
          muted={sc.muted}
          onPlayPause={radio.playPause}
          onSkip={radio.skip}
          onSeek={radio.seek}
          onVolume={(v) => {
            radio.setMuted(false)
            setSettings((s) => ({ ...s, volume: v }))
          }}
          onMute={() => radio.setMuted(!sc.muted)}
          onJoinLive={radio.joinLive}
          onFromStart={radio.fromStart}
        />
      )}
      {isOff ? (
        <p className="pip-note">Receiver idle. Select a station and press it again (or ENTER) to tune in.</p>
      ) : (
        !isSc && <p className="pip-note">{isYours ? 'Play an audio file from this device. It is never uploaded or saved, and is forgotten when the radio is switched off.' : station?.desc}</p>
      )}
      {isSc && (
        <a className="radio-credit" href={sc.meta.url} target="_blank" rel="noopener noreferrer">
          <span className="radio-credit__k">TRACK //</span> {sc.meta.title.toUpperCase()} <span aria-hidden="true">·</span> UPLOADED BY{' '}
          {sc.meta.uploader.toUpperCase()} <span aria-hidden="true">·</span> <span className="radio-credit__sc">SOUNDCLOUD ↗</span>
        </a>
      )}
      {!muted && !isSc && (
        <div className="pip-choices">
          {isYours && (
            <label className="pip-btn radio-file">
              {file ? '[ CHANGE FILE ]' : '[ LOAD AUDIO FILE ]'}
              <input type="file" accept="audio/*" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          )}
          {isOff ? (
            active && (
              <button className="pip-btn" onClick={() => tune(OFF)}>
                [ SIGNAL OFF ]
              </button>
            )
          ) : (
            <button className={`pip-btn${on ? ' is-active' : ''}`} disabled={isYours && !file} onClick={() => tune(on ? OFF : selected)}>
              {on ? '[ SIGNAL OFF ]' : '[ TUNE IN ]'}
            </button>
          )}
        </div>
      )}
      {isYours && file && <p className="pip-note">LOADED: {file.name}</p>}
      {scOn && !isSc && (
        <p className="radio-now">
          NOW STREAMING: {APPALACHIA_STATION.name} · {SC_STATUS[scStatus]}
        </p>
      )}
    </div>
  )

  return <ListDetail label="Radio stations" items={items} selected={selected} onSelect={setSelected} onActivate={(id) => tune(id)} detail={detail} />
}
