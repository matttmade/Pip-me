import { describe, expect, it, vi } from 'vitest'
import { bootApp, type PipLoader } from './handoff'

function fakeLoader() {
  const fns: (() => void)[] = []
  const loader: PipLoader = { step: vi.fn(), ready: vi.fn(), onExit: (fn) => fns.push(fn) }
  return { loader, exit: () => fns.forEach((f) => f()) }
}

const now = (fn: () => void) => fn()

describe('bootApp', () => {
  it('mounts immediately when there is no loader', () => {
    const mount = vi.fn()
    const markBooted = vi.fn()
    bootApp(mount, { loader: undefined, markBooted })
    expect(mount).toHaveBeenCalledOnce()
    expect(markBooted).not.toHaveBeenCalled()
  })

  it('mounts under the loader, reports the bundle, and signals ready after the first commit', () => {
    const { loader } = fakeLoader()
    let mounted: (() => void) | undefined
    bootApp((m) => (mounted = m), { loader, nextFrame: now, markBooted: vi.fn() })
    expect(loader.step).toHaveBeenCalledWith('bundle')
    expect(loader.ready).not.toHaveBeenCalled()
    mounted!()
    mounted!() // StrictMode runs effects twice
    expect(loader.ready).toHaveBeenCalledOnce()
  })

  it('waits a frame before ready so the app has painted', () => {
    const { loader } = fakeLoader()
    const frames: (() => void)[] = []
    bootApp((m) => m(), { loader, nextFrame: (fn) => frames.push(fn), markBooted: vi.fn() })
    expect(loader.ready).not.toHaveBeenCalled()
    frames.forEach((f) => f())
    expect(loader.ready).toHaveBeenCalledOnce()
  })

  it('marks the session booted only when the loader leaves', () => {
    const { loader, exit } = fakeLoader()
    const markBooted = vi.fn()
    bootApp((m) => m(), { loader, nextFrame: now, markBooted })
    expect(markBooted).not.toHaveBeenCalled()
    exit()
    expect(markBooted).toHaveBeenCalledOnce()
  })
})
