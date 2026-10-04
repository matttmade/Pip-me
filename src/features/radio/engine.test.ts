import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../lib/profile'
import { APPALACHIA_ID } from './soundcloud'

/* ---------- minimal Web Audio fake ---------- */

class FakeParam {
  value = 0
  setTargetAtTime = vi.fn()
  cancelScheduledValues = vi.fn()
}
class FakeNode {
  gain = new FakeParam()
  fftSize = 0
  connect<T>(n: T) {
    return n
  }
  disconnect = vi.fn()
}
const contexts: FakeCtx[] = []
class FakeCtx {
  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = new FakeNode()
  constructor() {
    contexts.push(this)
  }
  createAnalyser = () => new FakeNode()
  gains: FakeNode[] = []
  createGain = () => {
    const g = new FakeNode()
    this.gains.push(g)
    return g
  }
  resume = vi.fn(async () => void (this.state = 'running'))
  suspend = vi.fn(async () => void (this.state = 'suspended'))
  close = vi.fn(async () => void (this.state = 'closed'))
}

const graphs: Record<string, { stop: ReturnType<typeof vi.fn> }[]> = {}
const fakeStation = (id: string) => () => {
  const g = { stop: vi.fn(), setPaused: vi.fn() }
  ;(graphs[id] ??= []).push(g)
  return g
}
vi.mock('./stations', () => ({
  YOUR_STATION: 'YOURS',
  STATIONS: [
    { id: 'HUM', name: "OVERSEER'S HUM", freq: '88.1', desc: '', start: fakeStation('HUM') },
    { id: 'NUMBERS', name: 'MERIDIAN NUMBERS', freq: '93.7', desc: '', start: fakeStation('NUMBERS') },
  ],
  fileStation: () => fakeStation('YOURS'),
}))

type Engine = typeof import('./engine')
let E: Engine
let S: typeof import('../../lib/store')
let detach: () => void

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('AudioContext', FakeCtx)
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
  contexts.length = 0
  for (const k of Object.keys(graphs)) delete graphs[k]
  vi.resetModules()
  // Fresh store + engine per test (the engine keeps module-level state).
  S = await import('../../lib/store')
  S.resetAll()
  E = await import('./engine')
  detach = E.radio.attach()
})

afterEach(() => {
  detach()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const flush = async () => {
  await vi.advanceTimersByTimeAsync(500)
}

describe('radio engine', () => {
  it('tunes a procedural station and keeps one context running', async () => {
    E.radio.tune('HUM')
    await flush()
    expect(E.getRadioState().station).toBe('HUM')
    expect(E.getRadioState().analyser).not.toBeNull()
    expect(contexts).toHaveLength(1)
    expect(contexts[0].state).toBe('running')
  })

  it('tuning another station stops the previous graph', async () => {
    E.radio.tune('HUM')
    await flush()
    E.radio.tune('NUMBERS')
    await flush()
    expect(graphs.HUM[0].stop).toHaveBeenCalled()
    expect(graphs.NUMBERS[0].stop).not.toHaveBeenCalled()
    expect(E.getRadioState().station).toBe('NUMBERS')
    expect(contexts).toHaveLength(1)
  })

  it('activating the tuned station, or RADIO OFF, switches off and suspends the context', async () => {
    E.radio.tune('HUM')
    await flush()
    E.radio.tune('HUM')
    await flush()
    expect(E.getRadioState().station).toBeNull()
    expect(graphs.HUM[0].stop).toHaveBeenCalled()
    expect(contexts[0].state).toBe('suspended')
    E.radio.tune('NUMBERS')
    E.radio.tune('OFF')
    await flush()
    expect(E.getRadioState().station).toBeNull()
  })

  it('tuning the stream stops the synth and asks for a fresh widget', async () => {
    E.radio.tune('HUM')
    await flush()
    E.radio.tune(APPALACHIA_ID)
    await flush()
    const s = E.getRadioState()
    expect(graphs.HUM[0].stop).toHaveBeenCalled()
    expect(s.station).toBe(APPALACHIA_ID)
    expect(s.sc).toMatchObject({ status: 'loading', attempt: 1 })
  })

  it('SYSTEM sound off stops the radio and blocks tuning', async () => {
    E.radio.tune('HUM')
    await flush()
    S.writeStored('settings', { ...DEFAULT_SETTINGS, sound: false })
    await flush()
    expect(E.getRadioState().station).toBeNull()
    E.radio.tune('NUMBERS')
    expect(E.getRadioState().station).toBeNull()
  })

  it('SYSTEM volume applies live', async () => {
    E.radio.tune('HUM')
    await flush()
    S.writeStored('settings', { ...DEFAULT_SETTINGS, volume: 0.2 })
    const master = contexts[0].gains[0]
    expect(master.gain.setTargetAtTime).toHaveBeenCalledWith(0.2, expect.any(Number), expect.any(Number))
  })

  it('stream: progress is saved for the session and seek works untuned', async () => {
    E.radio.tune(APPALACHIA_ID)
    const ctl = { play: vi.fn(), pause: vi.fn(), toggle: vi.fn(), seek: vi.fn() }
    E.radio.registerSc(ctl)
    E.radio.onScStatus('playing')
    E.radio.onScProgress(10_000, 600_000)
    expect(S.readStored<{ position: number | null }>('radio:appalachia', { position: null }).position).toBe(10_000)
    E.radio.onScProgress(12_000, 600_000)
    expect(S.readStored<{ position: number | null }>('radio:appalachia', { position: null }).position).toBe(10_000)
    E.radio.skip(30_000)
    expect(ctl.seek).toHaveBeenCalledWith(42_000)
    E.radio.playPause()
    expect(ctl.toggle).toHaveBeenCalled()
    E.radio.stop()
    expect(E.getRadioState().station).toBeNull()
    E.radio.fromStart()
    expect(E.getRadioState().sc.position).toBe(0)
    expect(ctl.seek).toHaveBeenCalledTimes(1)
    expect(E.radio.scStartAt(600_000)).toBe(0)
  })

  it('YOUR STATION keeps its object URL until changed or switched off', async () => {
    E.radio.loadFile(new File(['x'], 'a.mp3'))
    await flush()
    const first = E.getRadioState().file!.url
    expect(E.getRadioState().station).toBe('YOURS')
    E.radio.tune('HUM')
    await flush()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    E.radio.loadFile(new File(['y'], 'b.mp3'))
    await flush()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(first)
    const second = E.getRadioState().file!.url
    E.radio.stop()
    await flush()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(second)
    expect(E.getRadioState().file).toBeNull()
  })

  it('detach stops everything and closes the context', async () => {
    E.radio.tune('HUM')
    await flush()
    detach()
    expect(graphs.HUM[0].stop).toHaveBeenCalled()
    expect(contexts[0].state).toBe('closed')
    expect(E.getRadioState().station).toBeNull()
    detach = () => {}
  })
})
