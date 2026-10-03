/**
 * Hand-off between the inline boot loader in index.html and the React app.
 *
 * The loader is the app's only boot sequence. It paints before the bundle downloads; when
 * main.tsx runs, `bootApp` tells it the bundle is in (`step('bundle')`), mounts React straight
 * away UNDER the loader, and once the first commit has painted calls `ready()`. The loader then
 * finishes its choreography and wipes away to reveal an app that is already rendered.
 * When it leaves, the session is marked as booted so a reload in the same session gets the
 * short version. With no loader (tests, script blocked, already gone) it just mounts.
 */
import { writeStored } from '../lib/store'

export type LoaderStep = 'bundle' | 'font'
export type PipLoader = {
  step: (id: LoaderStep) => void
  ready: () => void
  onExit: (fn: () => void) => void
}

declare global {
  interface Window {
    __pipLoader?: PipLoader
  }
}

/** Session flag the loader reads (read-only) to choose the short re-boot. */
export const BOOTED_KEY = 'booted'

type Options = {
  loader?: PipLoader
  nextFrame?: (fn: () => void) => void
  markBooted?: () => void
}

/**
 * `mount` renders the app and must call `mounted` after its first commit (e.g. from an effect).
 */
export function bootApp(mount: (mounted: () => void) => void, opts: Options = {}): void {
  const {
    loader = globalThis.window?.__pipLoader,
    nextFrame = (fn) => requestAnimationFrame(() => fn()),
    markBooted = () => void writeStored(BOOTED_KEY, true),
  } = opts
  if (!loader) return mount(() => {})
  loader.step('bundle')
  loader.onExit(markBooted)
  let signalled = false
  mount(() => {
    if (signalled) return
    signalled = true
    nextFrame(() => loader.ready())
  })
}
