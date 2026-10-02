import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { emit, type OverlayProps } from '../../lib/contracts'
import { PipSlider } from '../../shell/PipSlider'
import { CENTER_CROP, clampCrop, displayScale, MAX_SCALE, MIN_SCALE, panCrop, zoomCrop, type Crop } from './cropMath'
import { isImageFile, PRIVACY_NOTE, processHeadshot, useHeadshot } from './headshot'

type Size = { w: number; h: number }

/** Overlay: drag + zoom a photo inside a circle guide, then bake a 256px headshot. */
export default function HeadshotCropper({ payload, onClose }: OverlayProps) {
  const file = isImageFile(payload) ? payload : null
  const [, setHeadshot] = useHeadshot()
  const [url, setUrl] = useState<string | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [crop, setCrop] = useState<Crop>(CENTER_CROP)
  const [view, setView] = useState(280)
  const [error, setError] = useState<string | null>(file ? null : 'NO IMAGE RECEIVED.')
  const viewRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())

  // Read the file locally as a data URL (nothing is uploaded; no object URL to revoke).
  useEffect(() => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' && setUrl(reader.result)
    reader.onerror = () => setError('COULD NOT READ THAT FILE.')
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  // Track the guide's rendered size so drag distances map to source pixels.
  useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setView(el.clientWidth || 280))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Wheel zoom needs a non-passive listener to stop the page scrolling.
  useEffect(() => {
    const el = viewRef.current
    if (!el || !size) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setCrop((c) => zoomCrop(size.w, size.h, c, Math.exp(-e.deltaY * 0.0015)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [size])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current
    const prev = map.get(e.pointerId)
    if (!prev || !size) return
    const before = [...map.values()]
    map.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const after = [...map.values()]
    if (after.length === 1) {
      setCrop((c) => panCrop(size.w, size.h, c, e.clientX - prev.x, e.clientY - prev.y, view))
    } else if (after.length >= 2) {
      const dist = (p: { x: number; y: number }[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) || 1
      const mid = (p: { x: number; y: number }[]) => ({ x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 })
      const factor = dist(after) / dist(before)
      const m0 = mid(before)
      const m1 = mid(after)
      setCrop((c) => panCrop(size.w, size.h, zoomCrop(size.w, size.h, c, factor), m1.x - m0.x, m1.y - m0.y, view))
    }
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => void pointers.current.delete(e.pointerId)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!size) return
    const step = 12
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      setCrop((c) => panCrop(size.w, size.h, c, moves[e.key][0], moves[e.key][1], view))
    } else if (e.key === '+' || e.key === '=') setCrop((c) => zoomCrop(size.w, size.h, c, 1.1))
    else if (e.key === '-') setCrop((c) => zoomCrop(size.w, size.h, c, 1 / 1.1))
  }

  const confirm = () => {
    const img = imgRef.current
    if (!img || !size) return
    try {
      setHeadshot(processHeadshot(img, crop))
      emit({ type: 'headshot-set' })
      onClose()
    } catch (err) {
      console.warn('[headshot] processing failed', err)
      setError('COULD NOT PROCESS THAT IMAGE. TRY ANOTHER PHOTO.')
    }
  }

  // Place the image so the crop window fills the guide.
  const c = size ? clampCrop(size.w, size.h, crop) : crop
  const ds = size ? displayScale(size.w, size.h, c, view) : 1
  const imgStyle = size
    ? {
        width: size.w * ds,
        height: size.h * ds,
        transform: `translate(${view / 2 - c.x * size.w * ds}px, ${view / 2 - c.y * size.h * ds}px)`,
      }
    : { opacity: 0 }

  return (
    <div className="cropper">
      <h2>HEADSHOT CALIBRATION</h2>
      <p className="pip-note">Drag to line up your face in the circle. Pinch, scroll or use the slider to zoom.</p>
      <div
        ref={viewRef}
        className="cropper__view"
        data-no-swipe
        tabIndex={0}
        role="application"
        aria-label="Crop area. Arrow keys move, plus and minus zoom."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {url && (
          <img
            ref={imgRef}
            src={url}
            alt=""
            draggable={false}
            style={imgStyle}
            onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setError('COULD NOT READ THAT IMAGE. TRY A JPEG OR PNG.')}
          />
        )}
        <div className="cropper__tint" aria-hidden />
        <div className="cropper__guide" aria-hidden />
        {!size && !error && <p className="cropper__status">SCANNING<span className="cursor">▌</span></p>}
      </div>
      <PipSlider
        label="ZOOM"
        value={c.scale}
        min={MIN_SCALE}
        max={MAX_SCALE}
        onChange={(scale) => size && setCrop((p) => clampCrop(size.w, size.h, { ...p, scale }))}
        format={(v) => `${v.toFixed(1)}X`}
        disabled={!size}
      />
      {error && <p className="cropper__error">{error}</p>}
      <div className="pip-choices">
        <button type="button" className="pip-btn" onClick={confirm} disabled={!size}>
          [ CONFIRM ]
        </button>
        <button type="button" className="pip-btn" onClick={onClose}>
          [ CANCEL ]
        </button>
      </div>
      <p className="pip-note">{PRIVACY_NOTE}</p>
    </div>
  )
}
