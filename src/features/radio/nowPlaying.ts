import { useSyncExternalStore } from 'react'
import { getRadioState, subscribeRadio } from './engine'
import { isPlaying, stationName } from './radioState'

export type NowPlaying = { station: string | null; playing: boolean }

let last: NowPlaying = { station: null, playing: false }
function snapshot(): NowPlaying {
  const s = getRadioState()
  const station = stationName(s.station)
  const playing = isPlaying(s)
  if (station !== last.station || playing !== last.playing) last = { station, playing }
  return last
}

/**
 * Read-only "now playing" for hints outside RADIO. `station` is the tuned station's
 * display name (null when the radio is off); `playing` is true while it is audible
 * (the stream counts only once it actually plays).
 */
export const useNowPlaying = (): NowPlaying => useSyncExternalStore(subscribeRadio, snapshot, snapshot)
