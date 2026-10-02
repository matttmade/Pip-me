/**
 * Persistent radio engine. Playback lives here (and in the always-mounted RadioHost,
 * which holds the hidden SoundCloud iframe), not in RadioPanel, so leaving the RADIO
 * tab keeps the music going. RadioPanel is only a view/controller of this store.
 *
 * Lifecycle: RadioHost calls attach() on mount (subscribes to SYSTEM settings and page
 * visibility) and the returned detach() on unmount (stops everything, closes the context).
 */
import { useSyncExternalStore } from 'react'
import { emit } from '../../lib/events'
import { DEFAULT_SETTINGS, type Settings } from '../../lib/profile'
import { readStored, subscribeStored, writeStored } from '../../lib/store'
import { APPALACHIA_ID, type SoundMeta } from './soundcloud'
import { fileStation, STATIONS, YOUR_STATION, type StationGraph } from './stations'
import { initialRadioState, radioReducer, shouldSave, stationName, tuneIntent, type RadioAction, type RadioState, type ScStatus } from './radioState'
import { liveOffset, msOfDay, skipBy } from './transport'

/** Imperative transport of the hidden widget (registered by RadioHost). Calls before READY are ignored. */
export type ScControls = {
  play(): void
  pause(): void
  toggle(): void
  seek(ms: number): void
}

/** Session resume point for the streamed station (null = never tuned: join live). */
type ScStore = { position: number | null; duration: number }
const SC_KEY = 'radio:appalachia'
const SC_STORE: ScStore = { position: null, duration: 0 }

const settings = () => readStored<Settings>('settings', DEFAULT_SETTINGS)

/* ---------- store ---------- */

let state: RadioState = initialRadioState(readStored(SC_KEY, SC_STORE))
const listeners = new Set<() => void>()

function dispatch(a: RadioAction) {
  const next = radioReducer(state, a)
  if (next === state) return
  state = next
  listeners.forEach((fn) => fn())
}

export const getRadioState = () => state
export function subscribeRadio(fn: () => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export const useRadio = () => useSyncExternalStore(subscribeRadio, getRadioState, getRadioState)

/* ---------- Web Audio (procedural stations + YOUR STATION) ---------- */

type Audio = { ctx: AudioContext; analyser: AnalyserNode; master: GainNode }
type Live = { id: string; graph: StationGraph; bus: GainNode }
let audio: Audio | null = null
let live: Live | null = null

function ensureAudio(): Audio {
  if (audio) return audio
  const ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 2048
  const master = ctx.createGain()
  master.gain.value = settings().volume
  analyser.connect(master).connect(ctx.destination)
  audio = { ctx, analyser, master }
  dispatch({ type: 'analyser', analyser })
  return audio
}

/** Fade out and tear down the running graph; idle contexts are suspended to save CPU. */
function stopSynth() {
  const a = audio
  const cur = live
  live = null
  if (!a || !cur) return
  const t = a.ctx.currentTime
  cur.bus.gain.cancelScheduledValues(t)
  cur.bus.gain.setTargetAtTime(0, t, 0.04)
  const finish = () => {
    cur.graph.stop()
    cur.bus.disconnect()
    if (!live && audio === a && a.ctx.state === 'running') void a.ctx.suspend()
  }
  if (a.ctx.state === 'running') window.setTimeout(finish, 200)
  else finish()
}

function startSynth(id: string): boolean {
  const factory = id === YOUR_STATION ? (state.file ? fileStation(state.file.url) : undefined) : STATIONS.find((s) => s.id === id)?.start
  if (!factory) return false
  const a = ensureAudio()
  // Called from a user gesture: creating/resuming here satisfies autoplay rules.
  void a.ctx.resume()
  stopSynth()
  const bus = a.ctx.createGain()
  bus.gain.value = 0
  bus.gain.setTargetAtTime(1, a.ctx.currentTime, 0.15)
  bus.connect(a.analyser)
  live = { id, graph: factory(a.ctx, bus), bus }
  if (document.visibilityState === 'hidden') {
    live.graph.setPaused?.(true)
    void a.ctx.suspend()
  }
  return true
}

/* ---------- streamed station (SoundCloud widget in RadioHost) ---------- */

let sc: ScControls | null = null
let saved = state.sc.position || -Infinity

function saveSc(position: number, duration: number) {
  if (!(duration > 0)) return
  saved = position
  writeStored<ScStore>(SC_KEY, { position: Math.round(position), duration: Math.round(duration) }, SC_STORE)
}

/* ---------- local file ---------- */

function setFile(file: { url: string; name: string } | null) {
  const old = state.file
  dispatch({ type: 'file', file })
  // Revoke once the graph that used it has faded out and stopped (stopSynth takes 200 ms).
  if (old && old.url !== file?.url) window.setTimeout(() => URL.revokeObjectURL(old.url), 400)
}

/* ---------- public actions ---------- */

function start(id: string) {
  if (!settings().sound) return
  if (id === APPALACHIA_ID) {
    stopSynth()
    dispatch({ type: 'tune', station: id })
  } else if (startSynth(id)) {
    if (state.station === APPALACHIA_ID) saveSc(state.sc.position, state.sc.duration)
    dispatch({ type: 'tune', station: id })
  } else return
  emit({ type: 'radio-tuned', station: stationName(id) ?? id })
}

/** Everything off: stops the graph, unmounts the widget (via RadioHost), forgets the local file. */
function stop() {
  if (state.station === APPALACHIA_ID) saveSc(state.sc.position, state.sc.duration)
  stopSynth()
  dispatch({ type: 'off' })
  if (state.file) setFile(null)
}

export const radio = {
  /** List activation / TUNE IN / SIGNAL OFF. Must run inside a user gesture. */
  tune(id: string) {
    if (tuneIntent(state.station, id) === 'off') stop()
    else start(id)
  },
  stop,
  /** YOUR STATION: play a file from this device (never uploaded). Must run inside a user gesture. */
  loadFile(f: File) {
    const url = URL.createObjectURL(f)
    if (state.station === YOUR_STATION) stopSynth()
    setFile({ url, name: f.name })
    start(YOUR_STATION)
  },

  /* streamed-station transport */
  playPause() {
    if (state.station !== APPALACHIA_ID) return start(APPALACHIA_ID)
    if (state.sc.status === 'lost') return radio.retry()
    if (state.sc.status !== 'loading') sc?.toggle()
  },
  play: () => (state.station === APPALACHIA_ID ? sc?.play() : start(APPALACHIA_ID)),
  pause: () => sc?.pause(),
  /** Tuned: moves the widget's playhead. Not tuned: just moves the resume point. */
  seek(ms: number) {
    if (state.station === APPALACHIA_ID) sc?.seek(ms)
    dispatch({ type: 'sc-seek', position: ms })
    saveSc(ms, state.sc.duration)
  },
  skip: (deltaMs: number) => radio.seek(skipBy(state.sc.position, deltaMs, state.sc.duration)),
  joinLive: () => radio.seek(liveOffset(msOfDay(new Date()), state.sc.duration)),
  fromStart: () => radio.seek(0),
  setMuted: (muted: boolean) => dispatch({ type: 'sc-mute', muted }),
  retry: () => dispatch({ type: 'sc-retry' }),

  /* RadioHost wiring */
  registerSc(c: ScControls | null) {
    sc = c
  },
  /** First tune-in this session starts mid-"broadcast"; afterwards resume where it was. */
  scStartAt(duration: number) {
    const p = readStored(SC_KEY, SC_STORE).position
    return p == null ? liveOffset(msOfDay(new Date()), duration) : p
  },
  onScStatus(s: ScStatus) {
    dispatch({ type: 'sc-status', status: s })
    // Paused: remember exactly where.
    if (s === 'ready') saveSc(state.sc.position, state.sc.duration)
  },
  onScProgress(position: number, duration: number) {
    dispatch({ type: 'sc-progress', position, duration })
    if (shouldSave(position, saved)) saveSc(position, state.sc.duration)
  },
  onScMeta: (meta: SoundMeta) => dispatch({ type: 'sc-meta', meta }),

  /** Start following SYSTEM settings and page visibility. Returns detach (stops and releases everything). */
  attach(): () => void {
    let volume = settings().volume
    const offSettings = subscribeStored('settings', () => {
      const s = settings()
      if (!s.sound && state.station != null) stop()
      if (s.volume !== volume && audio) audio.master.gain.setTargetAtTime(s.volume, audio.ctx.currentTime, 0.05)
      volume = s.volume
    })
    // Hidden tab: suspend the whole graph (and pause media elements); resume only if tuned.
    const onVis = () => {
      const hidden = document.visibilityState === 'hidden'
      live?.graph.setPaused?.(hidden)
      if (!audio) return
      if (hidden) void audio.ctx.suspend()
      else if (live) void audio.ctx.resume()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      offSettings()
      document.removeEventListener('visibilitychange', onVis)
      // Tear down at once (no fade): the context is closed right after.
      const cur = live
      live = null
      cur?.graph.stop()
      cur?.bus.disconnect()
      stop()
      const a = audio
      audio = null
      sc = null
      dispatch({ type: 'analyser', analyser: null })
      if (a) void a.ctx.close()
    }
  },
}
