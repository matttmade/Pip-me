/**
 * Pure state for the persistent radio engine (engine.ts). Everything here is plain
 * data + transitions so it can be tested without Web Audio or the SoundCloud widget.
 */
import { APPALACHIA_ID, APPALACHIA_STATION, FALLBACK_META, type SoundMeta } from './soundcloud'
import { STATIONS, YOUR_STATION } from './stations'
import type { Envelope } from './waveform'

export const OFF = 'OFF'

export type ScStatus = 'loading' | 'ready' | 'playing' | 'lost'
export type LocalFile = { url: string; name: string }

export type ScState = {
  status: ScStatus
  /** Bumped on every tune-in / RETRY: the hidden widget is keyed on it (fresh iframe). */
  attempt: number
  position: number
  duration: number
  /** MUTE on the transport (the SYSTEM volume is kept). */
  muted: boolean
  meta: SoundMeta
  /** Loudness envelope of the track (SoundCloud waveform), null until fetched or when unavailable. */
  envelope: Envelope | null
}

export type RadioState = {
  /** Tuned station id (APPALACHIA_ID, a procedural station, YOUR_STATION) or null when off. */
  station: string | null
  sc: ScState
  /** YOUR STATION's loaded file (object URL owned by the engine). */
  file: LocalFile | null
  /** Analyser of the Web Audio graph (procedural stations and YOUR STATION). */
  analyser: AnalyserNode | null
}

export type RadioAction =
  | { type: 'tune'; station: string }
  | { type: 'off' }
  | { type: 'sc-status'; status: ScStatus }
  | { type: 'sc-progress'; position: number; duration: number }
  | { type: 'sc-seek'; position: number }
  | { type: 'sc-retry' }
  | { type: 'sc-mute'; muted: boolean }
  | { type: 'sc-meta'; meta: SoundMeta }
  | { type: 'sc-envelope'; envelope: Envelope | null }
  | { type: 'file'; file: LocalFile | null }
  | { type: 'analyser'; analyser: AnalyserNode | null }

/** Persist the streamed playhead at most this often while it runs. */
export const SAVE_EVERY = 5000

export function initialRadioState(saved?: { position: number | null; duration: number }): RadioState {
  return {
    station: null,
    sc: { status: 'loading', attempt: 0, position: saved?.position ?? 0, duration: saved?.duration ?? 0, muted: false, meta: FALLBACK_META, envelope: null },
    file: null,
    analyser: null,
  }
}

export function radioReducer(s: RadioState, a: RadioAction): RadioState {
  switch (a.type) {
    case 'tune':
      if (a.station === APPALACHIA_ID) return { ...s, station: a.station, sc: { ...s.sc, status: 'loading', attempt: s.sc.attempt + 1 } }
      return { ...s, station: a.station }
    case 'off':
      return s.station == null ? s : { ...s, station: null }
    case 'sc-status':
      return s.sc.status === a.status ? s : { ...s, sc: { ...s.sc, status: a.status } }
    case 'sc-progress': {
      const duration = a.duration > 0 ? a.duration : s.sc.duration
      if (s.sc.position === a.position && s.sc.duration === duration) return s
      return { ...s, sc: { ...s.sc, position: a.position, duration } }
    }
    case 'sc-seek':
      return { ...s, sc: { ...s.sc, position: a.position } }
    case 'sc-retry':
      return { ...s, sc: { ...s.sc, status: 'loading', attempt: s.sc.attempt + 1 } }
    case 'sc-mute':
      return s.sc.muted === a.muted ? s : { ...s, sc: { ...s.sc, muted: a.muted } }
    case 'sc-meta':
      return { ...s, sc: { ...s.sc, meta: a.meta } }
    case 'sc-envelope':
      return s.sc.envelope === a.envelope ? s : { ...s, sc: { ...s.sc, envelope: a.envelope } }
    case 'file':
      return { ...s, file: a.file }
    case 'analyser':
      return { ...s, analyser: a.analyser }
  }
}

/** Activating a list row: RADIO OFF, or the station already tuned, switches off; anything else tunes. */
export const tuneIntent = (current: string | null, id: string): 'off' | 'tune' => (id === OFF || id === current ? 'off' : 'tune')

/** Audible right now: a procedural/local station, or the stream while it reports PLAY. */
export const isPlaying = (s: Pick<RadioState, 'station' | 'sc'>) => s.station != null && (s.station !== APPALACHIA_ID || s.sc.status === 'playing')

/** Persist the playhead when it moved far enough from the last saved point. */
export const shouldSave = (position: number, lastSaved: number) => Math.abs(position - lastSaved) >= SAVE_EVERY

export function stationName(id: string | null): string | null {
  if (id == null || id === OFF) return null
  if (id === APPALACHIA_ID) return APPALACHIA_STATION.name
  if (id === YOUR_STATION) return 'YOUR STATION'
  return STATIONS.find((s) => s.id === id)?.name ?? id
}
