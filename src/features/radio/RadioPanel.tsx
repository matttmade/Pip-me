import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emit, pipRgb, useEffectsConfig, usePageVisible, usePrefersReducedMotion, useSettings, useStored } from '../../lib/contracts'
import { ListDetail, type ListItem } from '../../shell/ListDetail'
import { Oscilloscope } from './Oscilloscope'
import { ScTransport } from './ScTransport'
import { SoundCloudPlayer, type ScControls, type ScStatus } from './SoundCloudPlayer'
import { APPALACHIA_ID, APPALACHIA_STATION, buildWidgetUrl, FALLBACK_META, rgbToHex, simulatedSignal, type SoundMeta } from './soundcloud'
import { fileStation, STATIONS, YOUR_STATION, type StationFactory, type StationGraph } from './stations'
import { liveOffset, msOfDay, skipBy } from './transport'

const OFF = 'OFF'

type Engine = {
  ctx: AudioContext
  analyser: AnalyserNode
  master: GainNode
}
type Live = { id: string; graph: StationGraph; bus: GainNode }

/** Session resume point for the streamed station (null = never tuned: join live). */
type ScStore = { position: number | null; duration: number }
const SC_STORE: ScStore = { position: null, duration: 0 }
/** Persist the playhead at most this often while it runs. */
const SAVE_EVERY = 5000

const pct = (v: number) => `${Math.round(v * 100)}%`
const SC_STATUS: Record<ScStatus, string> = {
  loading: 'LOADING SIGNAL…',
  ready: 'PAUSED',
  playing: 'ON AIR',
  lost: 'SIGNAL LOST',
}

/** Station list as shown: the streamed station first, then the procedural ones. */
const LISTED = [APPALACHIA_STATION, ...STATIONS]

export default function RadioPanel() {
  const [settings, setSettings] = useSettings()
  const [cfg] = useEffectsConfig()
  const visible = usePageVisible()
  const [selected, setSelected] = useStored('radio:selected', APPALACHIA_ID)
  const [playing, setPlaying] = useState<string | null>(null)
  const [file, setFile] = useState<{ url: string; name: string } | null>(null)
  const engine = useRef<Engine | null>(null)
  const live = useRef<Live | null>(null)
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null)
  const [scStatus, setScStatus] = useState<ScStatus>('loading')
  const [scAttempt, setScAttempt] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const sc = useRef<ScControls>(null)
  const [scStore, setScStore] = useStored('radio:appalachia', SC_STORE)
  const [scPos, setScPos] = useState(scStore.position ?? 0)
  const [scDur, setScDur] = useState(scStore.duration)
  const [scMeta, setScMeta] = useState<SoundMeta>(FALLBACK_META)
  const [scMuted, setScMuted] = useState(false)
  const saved = useRef(scStore.position ?? -Infinity)

  const muted = !settings.sound
  const active = muted ? null : playing

  const stopCurrent = useCallback(() => {
    const e = engine.current
    const cur = live.current
    live.current = null
    if (!e || !cur) return
    const t = e.ctx.currentTime
    cur.bus.gain.cancelScheduledValues(t)
    cur.bus.gain.setTargetAtTime(0, t, 0.04)
    window.setTimeout(() => {
      cur.graph.stop()
      cur.bus.disconnect()
    }, e.ctx.state === 'running' ? 200 : 0)
  }, [])

  /** Must run inside a user gesture: creates/resumes the AudioContext. */
  const tune = useCallback(
    (id: string, url = file?.url) => {
      if (muted) return
      if (id === OFF || (id === playing && (live.current || id === APPALACHIA_ID))) {
        stopCurrent()
        setPlaying(null)
        return
      }
      if (id === APPALACHIA_ID) {
        // Streamed by the SoundCloud widget (cross-origin iframe), not the Web Audio graph.
        stopCurrent()
        setScStatus('loading')
        setScAttempt((n) => n + 1)
        setPlaying(id)
        emit({ type: 'radio-tuned', station: APPALACHIA_STATION.name })
        return
      }
      const factory: StationFactory | undefined =
        id === YOUR_STATION ? (url ? fileStation(url) : undefined) : STATIONS.find((s) => s.id === id)?.start
      if (!factory) return

      let e = engine.current
      if (!e) {
        const ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 2048
        const master = ctx.createGain()
        master.gain.value = settings.volume
        analyser.connect(master).connect(ctx.destination)
        e = engine.current = { ctx, analyser, master }
        setAnalyser(analyser)
      }
      void e.ctx.resume()
      stopCurrent()
      const bus = e.ctx.createGain()
      bus.gain.value = 0
      bus.gain.setTargetAtTime(1, e.ctx.currentTime, 0.15)
      bus.connect(e.analyser)
      live.current = { id, graph: factory(e.ctx, bus), bus }
      setPlaying(id)
      emit({ type: 'radio-tuned', station: id === YOUR_STATION ? 'YOUR STATION' : (STATIONS.find((s) => s.id === id)?.name ?? id) })
    },
    [muted, playing, file, settings.volume, stopCurrent],
  )

  /* ---------- streamed station: transport + session resume point ---------- */
  const scLatest = useRef({ pos: scPos, dur: scDur })
  useEffect(() => {
    scLatest.current = { pos: scPos, dur: scDur }
  })

  const saveSc = useCallback(
    (pos: number, dur: number) => {
      saved.current = pos
      setScStore({ position: Math.round(pos), duration: Math.round(dur) })
    },
    [setScStore],
  )

  const onScProgress = useCallback(
    (pos: number, dur: number) => {
      setScPos(pos)
      if (dur > 0) setScDur(dur)
      if (Math.abs(pos - saved.current) >= SAVE_EVERY) saveSc(pos, dur || scLatest.current.dur)
    },
    [saveSc],
  )

  const onScStatus = useCallback(
    (s: ScStatus) => {
      setScStatus(s)
      // Paused: remember exactly where.
      if (s === 'ready' && scLatest.current.dur > 0) saveSc(scLatest.current.pos, scLatest.current.dur)
    },
    [saveSc],
  )

  // First tune-in this session starts mid-"broadcast"; afterwards resume where it was.
  const scStartAt = useCallback(
    (dur: number) => (scStore.position == null ? liveOffset(msOfDay(new Date()), dur) : scStore.position),
    [scStore.position],
  )

  const scSeek = (ms: number) => {
    // Tuned: move the widget's playhead. Not tuned: just move the resume point.
    if (playing === APPALACHIA_ID) sc.current?.seek(ms)
    setScPos(ms)
    saveSc(ms, scLatest.current.dur)
  }

  // Leaving RADIO: keep the playhead for this session (store writes are idempotent).
  useEffect(
    () => () => {
      const { pos, dur } = scLatest.current
      if (dur > 0) saveSc(pos, dur)
    },
    [saveSc],
  )

  // Volume follows SYSTEM settings.
  useEffect(() => {
    const e = engine.current
    if (e) e.master.gain.setTargetAtTime(settings.volume, e.ctx.currentTime, 0.05)
  }, [settings.volume])

  // Muting in SYSTEM silences everything.
  useEffect(() => {
    // (SOUND lives in DATA > SYSTEM, so in practice this panel remounts with playing = null.)
    if (muted) stopCurrent()
  }, [muted, stopCurrent])

  // Hidden tab: suspend the whole graph (and pause media elements).
  useEffect(() => {
    const e = engine.current
    if (!e) return
    live.current?.graph.setPaused?.(!visible)
    if (visible && active) void e.ctx.resume()
    else void e.ctx.suspend()
  }, [visible, active])

  // Leaving RADIO: stop everything and release the context.
  useEffect(
    () => () => {
      const e = engine.current
      const cur = live.current
      engine.current = null
      live.current = null
      cur?.graph.stop()
      if (!e) return
      void e.ctx.close()
    },
    [],
  )

  // Object URLs are revoked when replaced or when the panel unmounts.
  useEffect(() => {
    if (!file) return
    return () => URL.revokeObjectURL(file.url)
  }, [file])

  const onFile = (f: File | undefined) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    if (playing === YOUR_STATION) stopCurrent()
    setFile({ url, name: f.name })
    setSelected(YOUR_STATION)
    tune(YOUR_STATION, url)
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
  const scVolume = scMuted ? 0 : settings.volume
  // The trace's height follows what you'd hear; paused, it freezes in place.
  const simulateSc = useMemo(() => {
    const level = 0.12 + 0.78 * Math.min(1, scVolume * 1.4)
    return (x: number, t: number) => simulatedSignal(x, t, level)
  }, [scVolume])

  const retrySc = () => {
    setScStatus('loading')
    setScAttempt((n) => n + 1)
  }
  const scPlayPause = () => {
    if (!scOn) return tune(APPALACHIA_ID)
    if (scStatus === 'lost') return retrySc()
    if (scStatus !== 'loading') sc.current?.toggle()
  }

  const detail = (
    <div className={`radio-detail pip-frame${isSc ? ' radio-detail--sc' : ''}`}>
      <h2 className="pip-frame__title">
        <span>{isOff ? 'RADIO OFF' : isYours ? 'YOUR STATION' : station?.name}</span>
        <small className="pip-frame__aside">{isOff ? '--.-' : isYours ? 'LOCAL' : `${station?.freq} MHZ`}</small>
      </h2>
      <div className="radio-scope" data-no-swipe>
        <Oscilloscope
          analyser={active && !scOn ? analyser : null}
          color={`${r}, ${g}, ${b}`}
          running={scOn ? visible && scLive && !reducedMotion : visible && active != null}
          simulate={scHeld ? simulateSc : undefined}
        />
        {scOn && <span className="radio-scope__tag">SIGNAL SIMULATED</span>}
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
          <button className="pip-btn" onClick={retrySc}>
            [ RETRY ]
          </button>
        </div>
      )}
      {isSc && !muted && (
        <ScTransport
          tuned={scOn}
          status={scStatus}
          position={scPos}
          duration={scDur}
          volume={settings.volume}
          muted={scMuted}
          onPlayPause={scPlayPause}
          onSkip={(d) => scSeek(skipBy(scPos, d, scDur))}
          onSeek={scSeek}
          onVolume={(v) => {
            setScMuted(false)
            setSettings((s) => ({ ...s, volume: v }))
          }}
          onMute={() => setScMuted((m) => !m)}
          onJoinLive={() => scSeek(liveOffset(msOfDay(new Date()), scDur))}
          onFromStart={() => scSeek(0)}
        />
      )}
      {isOff ? (
        <p className="pip-note">Receiver idle. Select a station and press it again (or ENTER) to tune in.</p>
      ) : (
        !isSc && <p className="pip-note">{isYours ? 'Play an audio file from this device. It is never uploaded or saved, and is forgotten when you leave.' : station?.desc}</p>
      )}
      {isSc && (
        <a className="radio-credit" href={scMeta.url} target="_blank" rel="noopener noreferrer">
          <span className="radio-credit__k">TRACK //</span> {scMeta.title.toUpperCase()} <span aria-hidden="true">·</span> UPLOADED BY{' '}
          {scMeta.uploader.toUpperCase()} <span aria-hidden="true">·</span> <span className="radio-credit__sc">SOUNDCLOUD ↗</span>
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
      {scOn && (
        <SoundCloudPlayer
          key={scAttempt}
          ref={sc}
          src={buildWidgetUrl(APPALACHIA_STATION.trackUrl, { color: rgbToHex([r, g, b]), autoPlay: false })}
          title={`SoundCloud player: ${APPALACHIA_STATION.name}`}
          volume={scVolume}
          visible={visible}
          startAt={scStartAt}
          onStatus={onScStatus}
          onProgress={onScProgress}
          onMeta={setScMeta}
        />
      )}
    </div>
  )

  return <ListDetail label="Radio stations" items={items} selected={selected} onSelect={setSelected} onActivate={(id) => tune(id)} detail={detail} />
}
