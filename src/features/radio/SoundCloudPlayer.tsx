import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import type { ScControls } from './engine'
import type { ScStatus } from './radioState'
import { loadWidgetApi, soundMeta, widgetVolume, type ScApi, type ScProgress, type ScWidget, type SoundMeta } from './soundcloud'

type Props = {
  /** Full widget iframe URL (buildWidgetUrl). Read once on mount. */
  src: string
  title: string
  /** Effective 0-1 volume (0 while this player is muted). */
  volume: number
  /** Page visibility: pause when hidden, resume on return if it was playing. */
  visible: boolean
  /** Where to start once the length is known (resume point or the pseudo-live offset). */
  startAt: (duration: number) => number
  onStatus: (s: ScStatus) => void
  onProgress: (position: number, duration: number) => void
  onMeta: (m: SoundMeta) => void
  ref?: Ref<ScControls>
}

const READY_TIMEOUT = 20000
/** After READY, give autoplay this long before showing PAUSED (and the PLAY button). */
const AUTOPLAY_GRACE = 6000
const EVENTS = ['READY', 'PLAY', 'PAUSE', 'FINISH', 'PLAY_PROGRESS', 'ERROR'] as const

/**
 * The official SoundCloud widget, streaming but visually hidden: a real-size iframe
 * clipped inside a 1px box (not display:none, which can stop playback). Our transport
 * drives it through the Widget API, and attribution is shown by RadioPanel.
 * Mounted by the always-present RadioHost only while tuned (keyed for a fresh RETRY),
 * so switching tabs doesn't touch it; unmounting pauses it.
 */
export function SoundCloudPlayer({ src, title, volume, visible, startAt, onStatus, onProgress, onMeta, ref }: Props) {
  const [api, setApi] = useState<ScApi | null>(null)
  const [frameSrc] = useState(src)
  const frame = useRef<HTMLIFrameElement>(null)
  const widget = useRef<ScWidget | null>(null)
  const playing = useRef(false)
  const resume = useRef(false)
  const duration = useRef(0)
  const vol = useRef(volume)
  const cb = useRef({ startAt, onStatus, onProgress, onMeta })

  useEffect(() => {
    vol.current = volume
    cb.current = { startAt, onStatus, onProgress, onMeta }
  })

  useImperativeHandle(
    ref,
    () => ({
      play: () => widget.current?.play(),
      pause: () => widget.current?.pause(),
      toggle: () => {
        const w = widget.current
        if (!w) return
        if (playing.current) w.pause()
        else w.play()
      },
      seek: (ms: number) => {
        const w = widget.current
        if (!w) return
        w.seekTo(ms)
        cb.current.onProgress(ms, duration.current)
      },
    }),
    [],
  )

  // 1. Inject the Widget API script (once per page) before the iframe exists.
  useEffect(() => {
    let dead = false
    cb.current.onStatus('loading')
    loadWidgetApi().then(
      (sc) => !dead && setApi(sc),
      () => !dead && cb.current.onStatus('lost'),
    )
    return () => {
      dead = true
    }
  }, [])

  // 2. Bind to the iframe right after it is inserted, before it finishes loading.
  useEffect(() => {
    const el = frame.current
    if (!api || !el) return
    const E = api.Widget.Events
    const w = api.Widget(el)
    let ready = false
    let pendingSeek: number | null = null
    let grace = 0
    const status = (s: ScStatus) => cb.current.onStatus(s)
    const timer = window.setTimeout(() => !ready && status('lost'), READY_TIMEOUT)
    const readDuration = (then?: (d: number) => void) =>
      w.getDuration((d) => {
        if (d > 0) duration.current = d
        then?.(duration.current)
      })

    w.bind(E.READY, () => {
      ready = true
      window.clearTimeout(timer)
      widget.current = w
      w.setVolume(widgetVolume(vol.current))
      w.getCurrentSound((s) => cb.current.onMeta(soundMeta(s)))
      readDuration((d) => {
        const at = d > 0 ? Math.max(0, Math.min(d - 1000, cb.current.startAt(d))) : 0
        pendingSeek = at
        if (at > 0) w.seekTo(at)
        cb.current.onProgress(at, d)
        w.play()
      })
      grace = window.setTimeout(() => !playing.current && status('ready'), AUTOPLAY_GRACE)
    })
    w.bind(E.PLAY, () => {
      playing.current = true
      window.clearTimeout(grace)
      status('playing')
      if (!duration.current) readDuration()
      // Some players drop a seek issued before the stream started: repeat it once.
      if (pendingSeek != null) {
        const at = pendingSeek
        pendingSeek = null
        if (at > 0) w.getPosition((p) => Math.abs(p - at) > 3000 && w.seekTo(at))
      }
    })
    w.bind(E.PAUSE, () => {
      playing.current = false
      status('ready')
    })
    w.bind(E.PLAY_PROGRESS, (e) => {
      const p = (e as ScProgress | undefined)?.currentPosition
      if (typeof p === 'number') cb.current.onProgress(p, duration.current)
    })
    // Loop the full track (the LOOP indicator is always on).
    w.bind(E.FINISH, () => {
      w.seekTo(0)
      w.play()
    })
    w.bind(E.ERROR, () => status('lost'))
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(grace)
      widget.current = null
      playing.current = false
      try {
        w.pause()
        for (const k of EVENTS) w.unbind(E[k])
      } catch {
        // iframe already gone
      }
    }
  }, [api])

  useEffect(() => {
    widget.current?.setVolume(widgetVolume(volume))
  }, [volume])

  useEffect(() => {
    const w = widget.current
    if (!w) return
    if (!visible) {
      resume.current = playing.current
      if (playing.current) w.pause()
    } else if (resume.current) {
      resume.current = false
      w.play()
    }
  }, [visible])

  if (!api) return null
  return (
    <div className="radio-sc__hide" aria-hidden="true">
      <iframe
        ref={frame}
        className="radio-sc__frame"
        title={title}
        src={frameSrc}
        width={300}
        height={166}
        tabIndex={-1}
        aria-hidden="true"
        allow="autoplay; encrypted-media"
        loading="eager"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
