import { useEffect, useRef, useState } from 'react'
import { loadWidgetApi, widgetVolume, type ScApi, type ScWidget } from './soundcloud'

export type ScStatus = 'loading' | 'ready' | 'playing' | 'lost'

type Props = {
  /** Full widget iframe URL (buildWidgetUrl). Read once on mount. */
  src: string
  title: string
  volume: number
  /** Page visibility: pause when hidden, resume on return if it was playing. */
  visible: boolean
  onStatus: (s: ScStatus) => void
}

const READY_TIMEOUT = 20000

/**
 * The official SoundCloud player, shown as a small strip while the station is tuned.
 * Mounted only while tuned (key it to force a fresh RETRY); unmounting pauses it.
 */
export function SoundCloudPlayer({ src, title, volume, visible, onStatus }: Props) {
  const [api, setApi] = useState<ScApi | null>(null)
  const [frameSrc] = useState(src)
  const frame = useRef<HTMLIFrameElement>(null)
  const widget = useRef<ScWidget | null>(null)
  const playing = useRef(false)
  const resume = useRef(false)
  const vol = useRef(volume)
  const status = useRef(onStatus)

  useEffect(() => {
    vol.current = volume
    status.current = onStatus
  })

  // 1. Inject the Widget API script (once per page) before the iframe exists.
  useEffect(() => {
    let dead = false
    status.current('loading')
    loadWidgetApi().then(
      (sc) => !dead && setApi(sc),
      () => !dead && status.current('lost'),
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
    const timer = window.setTimeout(() => !ready && status.current('lost'), READY_TIMEOUT)
    w.bind(E.READY, () => {
      ready = true
      window.clearTimeout(timer)
      widget.current = w
      w.setVolume(widgetVolume(vol.current))
      w.play()
      status.current('ready')
    })
    w.bind(E.PLAY, () => {
      playing.current = true
      status.current('playing')
    })
    w.bind(E.PAUSE, () => {
      playing.current = false
      status.current('ready')
    })
    // Loop the full track.
    w.bind(E.FINISH, () => {
      w.seekTo(0)
      w.play()
    })
    w.bind(E.ERROR, () => status.current('lost'))
    return () => {
      window.clearTimeout(timer)
      widget.current = null
      playing.current = false
      try {
        w.pause()
        for (const k of ['READY', 'PLAY', 'PAUSE', 'FINISH', 'ERROR']) w.unbind(E[k])
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
    <iframe
      ref={frame}
      className="radio-sc__frame"
      title={title}
      src={frameSrc}
      allow="autoplay; encrypted-media"
      loading="eager"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  )
}
