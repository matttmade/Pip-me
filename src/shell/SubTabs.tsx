import { useLayoutEffect, useRef, useState } from 'react'

type Props = { subs: readonly string[]; active: number; onChange: (i: number) => void }

/** Sliding strip: the active label is centered, neighbors fade with distance. */
export function SubTabs({ subs, active, onChange }: Props) {
  const strip = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)

  useLayoutEffect(() => {
    const el = strip.current
    const btn = el?.children[active] as HTMLElement | undefined
    if (!el || !btn) return
    const update = () => {
      const parent = el.parentElement!
      setOffset(parent.clientWidth / 2 - (btn.offsetLeft + btn.offsetWidth / 2))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el.parentElement!)
    return () => ro.disconnect()
  }, [active, subs])

  return (
    <div className="sub-tabs" role="tablist" aria-label="Sub sections">
      <div className="sub-tabs__strip" ref={strip} style={{ transform: `translateX(${offset}px)` }}>
        {subs.map((s, i) => (
          <button
            key={s}
            role="tab"
            aria-selected={i === active}
            tabIndex={i === active ? 0 : -1}
            className={`sub-tab${i === active ? ' is-active' : ''}`}
            style={{ opacity: i === active ? 1 : Math.max(0.25, 0.6 - Math.abs(i - active) * 0.15) }}
            onClick={() => onChange(i)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
