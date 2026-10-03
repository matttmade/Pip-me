/**
 * How this device can put Pip-Me on its Home Screen.
 * - android-prompt: Chromium fired `beforeinstallprompt`, so a real one-tap Install works.
 * - android-manual: Android browser without the event (Firefox, some Samsung builds): use the menu.
 * - ios: no install API on iOS (any browser); Share sheet → "Add to Home Screen".
 * - in-app: Instagram/Facebook/TikTok/etc. webviews can't install; open in the real browser.
 * - standalone: already launched from the Home Screen.
 * - desktop: not a phone/tablet; we don't nag.
 */
export type InstallPath = 'standalone' | 'android-prompt' | 'android-manual' | 'ios' | 'in-app' | 'desktop'

export type PlatformInput = {
  ua: string
  standalone: boolean // display-mode: standalone/fullscreen, or navigator.standalone (iOS)
  maxTouchPoints: number
  hasPrompt: boolean
}

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|musical_ly|Twitter|Snapchat|Pinterest|LinkedInApp|GSA\/|; wv\)/i

export function installPath({ ua, standalone, maxTouchPoints, hasPrompt }: PlatformInput): InstallPath {
  if (standalone) return 'standalone'
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1) // iPadOS reports as Mac
  const android = /Android/i.test(ua)
  if ((ios || android) && IN_APP.test(ua)) return 'in-app'
  if (ios) return 'ios'
  if (android) return hasPrompt ? 'android-prompt' : 'android-manual'
  return 'desktop'
}

/** Which iOS browser, for wording ("Share" lives in different places). */
export const iosBrowser = (ua: string): 'safari' | 'chrome' | 'edge' | 'firefox' | 'other' =>
  /CriOS/i.test(ua) ? 'chrome' : /EdgiOS/i.test(ua) ? 'edge' : /FxiOS/i.test(ua) ? 'firefox' : /Safari/i.test(ua) ? 'safari' : 'other'

const DAY = 86_400_000
/** Don't nag: show after a short delay, and not again for 14 days once dismissed. */
export const shouldOffer = (path: InstallPath, dismissedAt: number | null, now = Date.now()) =>
  path !== 'standalone' && path !== 'desktop' && (dismissedAt === null || now - dismissedAt > 14 * DAY)
