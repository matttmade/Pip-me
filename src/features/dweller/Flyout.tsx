import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { menuStep, type FlyoutId } from './flyout'

export type FlyoutItem = {
  key: string
  icon: ReactNode
  label: ReactNode
  /** Right-hand detail (ammo, key hint). */
  meta?: ReactNode
  ariaLabel: string
  title?: string
  /** Radio-style menus mark the current pick. */
  checked?: boolean
  className?: string
  onSelect: () => void
}

type Props = {
  id: FlyoutId
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which bottom corner of the stage it sits in; the menu opens up and inward from it. */
  side: 'left' | 'right'
  className?: string
  triggerLabel: string
  triggerTitle?: string
  /** Inside the round trigger (a glyph, plus any badge). */
  trigger: ReactNode
  /** Tiny caption under the ring. */
  caption: ReactNode
  menuLabel: string
  items: FlyoutItem[]
  /** Rendered beside the trigger (notes, the nuke banner). */
  children?: ReactNode
}

/**
 * A round STATUS trigger in a corner of the figure stage that fans a short menu up out of it.
 * Closes on selection, Esc, or a tap anywhere else (that tap is swallowed when it lands on the
 * figure, so dismissing never punches). Arrow keys stay inside the menu (data-own-arrows).
 */
export function Flyout({ id, open, onOpenChange, side, className = '', triggerLabel, triggerTitle, trigger, caption, menuLabel, items, children }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const radio = items.some((i) => i.checked !== undefined)

  const itemEls = () => Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('.flyout__item') ?? [])
  const close = (refocus: boolean) => {
    onOpenChange(false)
    if (refocus) btn.current?.focus({ preventScroll: true })
  }
  const closeRef = useRef(close)
  useLayoutEffect(() => {
    closeRef.current = close
  })

  // focus the current pick (or the first item) as it opens
  useEffect(() => {
    if (!open) return
    const els = itemEls()
    const at = Math.max(0, items.findIndex((i) => i.checked))
    els[at]?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (!t || root.current?.contains(t)) return
      closeRef.current(false)
      // a dismiss tap on the figure shouldn't also fire the weapon / a gesture
      if (t.closest('.status-stage') && !t.closest('.flyout')) {
        e.stopPropagation()
        const swallow = (c: MouseEvent) => {
          c.stopPropagation()
          c.preventDefault()
        }
        window.addEventListener('click', swallow, { capture: true, once: true })
        window.setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 600)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeRef.current(root.current?.contains(document.activeElement) ?? false)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') return close(false)
    const els = itemEls()
    const i = els.indexOf(document.activeElement as HTMLButtonElement)
    const next = menuStep(e.key, i, els.length, 'up')
    if (next == null) return
    e.preventDefault()
    els[next]?.focus({ preventScroll: true })
  }

  const onTriggerKey = (e: React.KeyboardEvent) => {
    // ↑ opens the menu from the keyboard, like a menu button
    if (e.key === 'ArrowUp' && !open) {
      e.preventDefault()
      onOpenChange(true)
    }
  }

  return (
    <div ref={root} className={`flyout flyout--${id} flyout--${side}${open ? ' is-open' : ''} ${className}`} data-no-swipe>
      {children}
      {open && (
        <div ref={menu} id={menuId} className="flyout__menu" role="menu" aria-label={menuLabel} data-own-arrows onKeyDown={onMenuKey}>
          {items.map((it, i) => (
            <button
              key={it.key}
              type="button"
              role={radio ? 'menuitemradio' : 'menuitem'}
              aria-checked={radio ? !!it.checked : undefined}
              aria-label={it.ariaLabel}
              title={it.title}
              tabIndex={-1}
              className={`flyout__item${it.checked ? ' is-checked' : ''}${it.className ? ` ${it.className}` : ''}`}
              style={{ '--i': i } as React.CSSProperties}
              onClick={() => {
                it.onSelect()
                close(true)
              }}
            >
              <span className="flyout__icon" aria-hidden>
                {it.icon}
              </span>
              <span className="flyout__label" aria-hidden>
                {it.label}
              </span>
              {it.meta != null && (
                <span className="flyout__meta" aria-hidden>
                  {it.meta}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <button
        ref={btn}
        type="button"
        className="flyout__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={triggerLabel}
        title={triggerTitle}
        onClick={() => onOpenChange(!open)}
        onKeyDown={onTriggerKey}
      >
        <span className="flyout__ring" aria-hidden>
          {trigger}
        </span>
        <span className="flyout__caption" aria-hidden>
          {caption}
        </span>
      </button>
    </div>
  )
}
