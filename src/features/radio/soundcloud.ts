/**
 * SoundCloud-streamed station. Nothing is downloaded or self-hosted: the official
 * SoundCloud widget (iframe + Widget API) streams the track and carries its branding.
 */

export const APPALACHIA_ID = 'APPALACHIA'
export const APPALACHIA_TRACK_URL = 'https://soundcloud.com/user-94305073/fallout-76-appalachia-radio'

export const APPALACHIA_STATION = {
  id: APPALACHIA_ID,
  name: 'APPALACHIA RADIO',
  freq: '97.6',
  desc: 'A wandering signal out of the hills. Streamed live from SoundCloud.',
  trackUrl: APPALACHIA_TRACK_URL,
} as const

export const SC_PLAYER_ORIGIN = 'https://w.soundcloud.com'
export const SC_API_SRC = `${SC_PLAYER_ORIGIN}/player/api.js`

/** [r, g, b] 0-255 → "rrggbb" (lowercase, no #). Values are clamped and rounded. */
export function rgbToHex([r, g, b]: readonly [number, number, number]): string {
  return [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')
}

export type WidgetUrlOptions = {
  /** Hex color without '#', e.g. from rgbToHex(pipRgb(hue)). */
  color: string
  autoPlay: boolean
}

/** URL for the compact (visual=false) SoundCloud player iframe. */
export function buildWidgetUrl(trackUrl: string, { color, autoPlay }: WidgetUrlOptions): string {
  const params = new URLSearchParams({
    url: trackUrl,
    color: `#${color.replace(/^#/, '')}`,
    auto_play: String(autoPlay),
    hide_related: 'true',
    show_comments: 'false',
    show_user: 'true',
    show_reposts: 'false',
    show_teaser: 'false',
    visual: 'false',
  })
  return `${SC_PLAYER_ORIGIN}/player/?${params.toString()}`
}

/** SYSTEM volume (0-1) → widget volume (0-100). */
export const widgetVolume = (v: number) => Math.round(Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)) * 100)

/**
 * Stylized waveform for the oscilloscope, since cross-origin iframe audio can't be
 * analysed. x in [0, 1] across the screen, t in seconds, level 0 (flat) to 1.
 * Layered sines with a slow, deterministic "breathing" so it reads as music, not a test tone.
 */
export function simulatedSignal(x: number, t: number, level: number): number {
  if (level <= 0) return 0
  const env = 0.55 + 0.25 * Math.sin(t * 1.3) + 0.2 * Math.sin(t * 3.7 + 1.1)
  const phase = x * Math.PI * 2
  const v =
    0.55 * Math.sin(phase * 3 + t * 2.1) +
    0.25 * Math.sin(phase * 7.2 - t * 3.3 + Math.sin(t * 0.7) * 2) +
    0.12 * Math.sin(phase * 17 + t * 9.1) +
    0.08 * Math.sin(phase * 41 + t * 23 + Math.sin(t * 5.3))
  return Math.max(-1, Math.min(1, v * env * level))
}

/* ---------- Widget API loader ---------- */

type Bindable = Record<string, string>
export type ScWidget = {
  bind(event: string, fn: (e?: unknown) => void): void
  unbind(event: string): void
  play(): void
  pause(): void
  seekTo(ms: number): void
  setVolume(v: number): void
}
export type ScApi = { Widget: ((el: HTMLIFrameElement) => ScWidget) & { Events: Bindable } }

declare global {
  interface Window {
    SC?: ScApi
  }
}

let loading: Promise<ScApi> | null = null

/** Injects the Widget API script once. A failed load is forgotten so RETRY can try again. */
export function loadWidgetApi(timeoutMs = 15000): Promise<ScApi> {
  if (window.SC?.Widget) return Promise.resolve(window.SC)
  if (loading) return loading
  loading = new Promise<ScApi>((resolve, reject) => {
    const old = document.querySelector<HTMLScriptElement>(`script[src="${SC_API_SRC}"]`)
    old?.remove()
    const s = document.createElement('script')
    s.src = SC_API_SRC
    s.async = true
    const timer = window.setTimeout(() => fail(new Error('timeout')), timeoutMs)
    function fail(err: Error) {
      window.clearTimeout(timer)
      s.remove()
      loading = null
      reject(err)
    }
    s.onload = () => {
      window.clearTimeout(timer)
      if (window.SC?.Widget) resolve(window.SC)
      else fail(new Error('SC.Widget missing'))
    }
    s.onerror = () => fail(new Error('script failed'))
    document.head.appendChild(s)
  })
  return loading
}
