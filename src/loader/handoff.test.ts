import { describe, expect, it, vi } from 'vitest'
import { afterLoader, type PipLoader } from './handoff'

function fakeLoader() {
  const fns: (() => void)[] = []
  const loader: PipLoader = { onExit: (fn) => fns.push(fn), ready: vi.fn() }
  return { loader, exit: () => fns.forEach((f) => f()) }
}

describe('afterLoader', () => {
  it('mounts immediately when there is no loader', () => {
    const mount = vi.fn()
    afterLoader(mount, undefined)
    expect(mount).toHaveBeenCalledOnce()
  })

  it('signals ready and waits for the loader to start exiting', () => {
    const { loader, exit } = fakeLoader()
    const mount = vi.fn()
    afterLoader(mount, loader)
    expect(loader.ready).toHaveBeenCalledOnce()
    expect(mount).not.toHaveBeenCalled()
    exit()
    exit()
    expect(mount).toHaveBeenCalledOnce()
  })
})
