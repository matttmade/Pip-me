import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStored } from '../../lib/store'
import { useBootDone } from '../../loader/handoff'
import { consumeOpenRequest, isStandalone, runInstallPrompt, useInstallState } from './installStore'
import { installPath, iosBrowser, shouldOffer, type InstallPath } from './platform'

const DISMISS_KEY = 'saved:install-dismissed'

const ShareGlyph = () => (
  <svg viewBox="0 0 24 24" className="install__glyph" aria-hidden>
    <path d="M12 3v12 M8 7l4-4 4 4 M6 11H4v10h16V11h-2" />
  </svg>
)
const PlusGlyph = () => (
  <svg viewBox="0 0 24 24" className="install__glyph" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="4" />
    <path d="M12 8v8 M8 12h8" />
  </svg>
)
const DotsGlyph = () => (
  <svg viewBox="0 0 24 24" className="install__glyph" aria-hidden>
    <path d="M12 5h.01 M12 12h.01 M12 19h.01" strokeWidth="3" />
  </svg>
)

/**
 * Phones only: a small Pip-styled sheet offering to put Pip-Me on the Home Screen, which then
 * launches full screen with no browser bars. One-tap install where the browser supports it
 * (Android Chromium), step-by-step Share-sheet instructions on iOS, "open in your browser" in
 * in-app webviews. Shown once a few seconds after boot; dismissing hides it for 14 days.
 */
export function InstallPrompt() {
  const bootDone = useBootDone()
  const state = useInstallState()
  const [dismissedAt, setDismissedAt] = useStored<number | null>(DISMISS_KEY, null)
  const [open, setOpen] = useState(false)
  const ua = navigator.userAgent
  const path: InstallPath = useMemo(
    () => installPath({ ua, standalone: isStandalone(), maxTouchPoints: navigator.maxTouchPoints || 0, hasPrompt: state === 'ready' }),
    [ua, state],
  )

  useEffect(() => {
    // requested from SYSTEM: open on the next tick; otherwise offer once, a few seconds after boot
    const requested = state === 'requested' && consumeOpenRequest()
    if (!requested && (!bootDone || !shouldOffer(path, dismissedAt))) return
    const t = window.setTimeout(() => setOpen(true), requested ? 0 : 6000)
    return () => window.clearTimeout(t)
  }, [bootDone, state, dismissedAt, path])

  if (!open || path === 'standalone') return null
  const close = () => {
    setOpen(false)
    setDismissedAt(Date.now())
  }
  const browser = iosBrowser(ua)

  return createPortal(
    <div className="install" role="dialog" aria-modal="false" aria-labelledby="install-title">
      <div className="install__sheet">
        <button className="install__x" onClick={close} aria-label="Not now">
          ×
        </button>
        <img className="install__icon" src="/icons/icon-192.png" alt="" width={56} height={56} />
        <div className="install__head">
          <h2 id="install-title">INSTALL PIP-ME</h2>
          <p>Add it to your Home Screen for the full-screen Pip-Boy, no browser bars.</p>
        </div>

        {path === 'android-prompt' && (
          <button
            className="install__cta"
            onClick={async () => {
              await runInstallPrompt()
              setOpen(false)
            }}
          >
            [ INSTALL ]
          </button>
        )}

        {path === 'ios' && (
          <ol className="install__steps">
            <li>
              Tap <ShareGlyph /> <b>Share</b>
              {browser === 'safari' ? ' in the toolbar' : browser === 'chrome' || browser === 'edge' ? ' in the address bar' : ''}
              {browser === 'safari' && <small> (tap ··· first if you don't see it)</small>}
            </li>
            <li>
              Choose <PlusGlyph /> <b>Add to Home Screen</b> <small>(scroll down if needed)</small>
            </li>
            <li>
              Turn on <b>Open as Web App</b> if shown, then tap <b>Add</b>
            </li>
          </ol>
        )}

        {path === 'android-manual' && (
          <ol className="install__steps">
            <li>
              Open the browser menu <DotsGlyph />
            </li>
            <li>
              Tap <PlusGlyph /> <b>Add to Home screen</b> or <b>Install</b>
            </li>
          </ol>
        )}

        {path === 'in-app' && (
          <p className="install__note">
            This app's built-in browser can't install. Tap ··· and choose <b>Open in Safari</b> / <b>Open in Chrome</b>, then add it from there.
          </p>
        )}

        <button className="install__later" onClick={close}>
          NOT NOW
        </button>
      </div>
    </div>,
    document.body,
  )
}
