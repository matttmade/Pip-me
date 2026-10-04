import { useLayoutEffect, useRef, useState } from 'react'
import { PipMeLogo } from './PipMeLogo'
import { rimPath } from './rimPath'

type Props = { left: number; top: number; width: number; height: number; radius: number; compact: boolean }

/**
 * SCREEN view: the glowing phosphor rim around the glass, notched at the top for a small
 * ROBCO INDUSTRIES maker's mark and at the bottom for the Pip-Me wordmark.
 */
export function ScreenRim({ left, top, width, height, radius, compact }: Props) {
  const topRef = useRef<HTMLSpanElement>(null)
  const bottomRef = useRef<HTMLSpanElement>(null)
  const [gaps, setGaps] = useState({ top: 0, bottom: 0 })
  const offset = compact ? 5 : 8
  const pad = 24

  useLayoutEffect(() => {
    const measure = () =>
      setGaps({ top: (topRef.current?.offsetWidth ?? 0) + 22, bottom: (bottomRef.current?.offsetWidth ?? 0) + 22 })
    measure()
    const ro = new ResizeObserver(measure)
    if (topRef.current) ro.observe(topRef.current)
    if (bottomRef.current) ro.observe(bottomRef.current)
    return () => ro.disconnect()
  }, [compact])

  const d = rimPath({ w: width, h: height, radius, offset, topGap: gaps.top, bottomGap: gaps.bottom, tick: compact ? 3 : 5 })

  return (
    <div className={`screen-rim${compact ? ' screen-rim--compact' : ''}`} style={{ left, top, width, height, borderRadius: radius, '--rim-offset': `${offset}px` } as React.CSSProperties} aria-hidden>
      <svg className="screen-rim__svg" style={{ left: -pad, top: -pad, width: width + 2 * pad, height: height + 2 * pad }} viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}>
        <path d={d} />
      </svg>
      <span ref={topRef} className="screen-rim__label screen-rim__label--top">
        ROBCO INDUSTRIES
      </span>
      <span ref={bottomRef} className="screen-rim__label screen-rim__label--bottom">
        <PipMeLogo variant="phosphor" />
      </span>
    </div>
  )
}
