import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { barrelMap, curvatureToK } from './barrel'

/**
 * Shows the flat UI on a curved tube: an SVG displacement filter bulges the live DOM
 * (optional; visuals only, hit-testing stays flat, so k stays small), the tube clips to a
 * rounded shape with black overscan, and unwarped glass layers sit on top.
 */
export function CrtGlass({ curvature, warp, children }: { curvature: number; warp: boolean; children: ReactNode }) {
  const id = useId().replace(/:/g, '')
  const tube = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const k = curvatureToK(curvature)

  useEffect(() => {
    const el = tube.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const map = useMemo(() => {
    if (!warp || k <= 0 || !size.w || !size.h) return null
    const mw = Math.max(16, Math.round(size.w / 6))
    const mh = Math.max(16, Math.round(size.h / 6))
    const m = barrelMap(mw, mh, size.w, size.h, k)
    const c = document.createElement('canvas')
    c.width = mw
    c.height = mh
    c.getContext('2d')?.putImageData(new ImageData(m.data as Uint8ClampedArray<ArrayBuffer>, mw, mh), 0, 0)
    return { url: c.toDataURL(), scale: m.scale }
  }, [warp, k, size.w, size.h])

  return (
    <div className="crt" style={{ '--k': k } as React.CSSProperties}>
      <div className="crt__tube" ref={tube} style={map ? { filter: `url(#crt-warp-${id})` } : undefined}>
        {children}
      </div>
      <div className="crt__glass" aria-hidden>
        <span className="crt__edge" />
        <span className="crt__reflect" />
        <span className="crt__streak" />
        <span className="crt__rim" />
      </div>
      {map && (
        <svg className="fx-defs" width="0" height="0" aria-hidden focusable="false">
          <filter id={`crt-warp-${id}`} x="0" y="0" width={size.w} height={size.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feImage href={map.url} x="0" y="0" width={size.w} height={size.h} preserveAspectRatio="none" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={map.scale} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
      )}
    </div>
  )
}
