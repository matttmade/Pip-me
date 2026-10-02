/**
 * Hand-off between the inline boot loader in index.html and the React app.
 *
 * The loader paints before the bundle downloads. Once main.tsx runs it calls `afterLoader(mount)`:
 * the loader is told the bundle is ready, and React mounts the moment the loader starts its
 * power-off, so the text BootSequence plays in full underneath rather than behind the loader.
 * With no loader (tests, script blocked, already gone) it mounts straight away.
 */
export type PipLoader = { onExit: (fn: () => void) => void; ready: () => void }

declare global {
  interface Window {
    __pipLoader?: PipLoader
  }
}

export function afterLoader(mount: () => void, loader: PipLoader | undefined = globalThis.window?.__pipLoader): void {
  if (!loader) return mount()
  let mounted = false
  loader.onExit(() => {
    if (mounted) return
    mounted = true
    mount()
  })
  loader.ready()
}
