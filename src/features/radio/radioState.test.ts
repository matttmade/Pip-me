import { describe, expect, it } from 'vitest'
import { initialRadioState, isPlaying, OFF, radioReducer, shouldSave, stationName, tuneIntent } from './radioState'
import { APPALACHIA_ID } from './soundcloud'
import { YOUR_STATION } from './stations'

describe('radioReducer', () => {
  it('starts off, with the saved resume point', () => {
    const s = initialRadioState({ position: 42_000, duration: 90_000 })
    expect(s.station).toBeNull()
    expect(s.sc.position).toBe(42_000)
    expect(s.sc.duration).toBe(90_000)
    expect(initialRadioState().sc.position).toBe(0)
  })

  it('tuning the stream resets its status and bumps the widget key', () => {
    const s = radioReducer(initialRadioState(), { type: 'tune', station: APPALACHIA_ID })
    expect(s.station).toBe(APPALACHIA_ID)
    expect(s.sc.status).toBe('loading')
    expect(s.sc.attempt).toBe(1)
    const again = radioReducer(radioReducer(s, { type: 'sc-status', status: 'lost' }), { type: 'sc-retry' })
    expect(again.sc.status).toBe('loading')
    expect(again.sc.attempt).toBe(2)
  })

  it('tuning a procedural station leaves the stream state alone', () => {
    const s0 = initialRadioState()
    const s = radioReducer(s0, { type: 'tune', station: 'HUM' })
    expect(s.station).toBe('HUM')
    expect(s.sc).toBe(s0.sc)
  })

  it('off clears the station and is a no-op when already off', () => {
    const s0 = initialRadioState()
    expect(radioReducer(s0, { type: 'off' })).toBe(s0)
    const on = radioReducer(s0, { type: 'tune', station: 'HUM' })
    expect(radioReducer(on, { type: 'off' }).station).toBeNull()
  })

  it('progress keeps the last known length when the widget reports 0', () => {
    let s = radioReducer(initialRadioState(), { type: 'sc-progress', position: 1000, duration: 60_000 })
    s = radioReducer(s, { type: 'sc-progress', position: 2000, duration: 0 })
    expect(s.sc).toMatchObject({ position: 2000, duration: 60_000 })
    expect(radioReducer(s, { type: 'sc-progress', position: 2000, duration: 0 })).toBe(s)
  })

  it('seek, mute and file update their fields', () => {
    let s = radioReducer(initialRadioState(), { type: 'sc-seek', position: 5000 })
    s = radioReducer(s, { type: 'sc-mute', muted: true })
    s = radioReducer(s, { type: 'file', file: { url: 'blob:x', name: 'a.mp3' } })
    expect(s.sc.position).toBe(5000)
    expect(s.sc.muted).toBe(true)
    expect(s.file?.name).toBe('a.mp3')
  })
})

describe('helpers', () => {
  it('tuneIntent: RADIO OFF or the tuned station switch off', () => {
    expect(tuneIntent('HUM', OFF)).toBe('off')
    expect(tuneIntent('HUM', 'HUM')).toBe('off')
    expect(tuneIntent('HUM', APPALACHIA_ID)).toBe('tune')
    expect(tuneIntent(null, 'HUM')).toBe('tune')
  })

  it('isPlaying: the stream counts only while it plays', () => {
    const s = radioReducer(initialRadioState(), { type: 'tune', station: APPALACHIA_ID })
    expect(isPlaying(s)).toBe(false)
    expect(isPlaying(radioReducer(s, { type: 'sc-status', status: 'playing' }))).toBe(true)
    expect(isPlaying(radioReducer(s, { type: 'tune', station: 'HUM' }))).toBe(true)
    expect(isPlaying(initialRadioState())).toBe(false)
  })

  it('shouldSave every 5 s of movement', () => {
    expect(shouldSave(4999, 0)).toBe(false)
    expect(shouldSave(5000, 0)).toBe(true)
    expect(shouldSave(0, -Infinity)).toBe(true)
  })

  it('stationName', () => {
    expect(stationName(null)).toBeNull()
    expect(stationName(OFF)).toBeNull()
    expect(stationName(APPALACHIA_ID)).toBe('APPALACHIA RADIO')
    expect(stationName(YOUR_STATION)).toBe('YOUR STATION')
    expect(stationName('HUM')).toBe("OVERSEER'S HUM")
  })
})
