import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { emit } from '../lib/events'

export type ListItem = { id: string; label: ReactNode; right?: ReactNode; disabled?: boolean }

type Props = {
  items: ListItem[]
  selected: string | undefined
  onSelect: (id: string) => void
  onActivate?: (id: string) => void
  detail: ReactNode
  /** Listen for arrow keys / Enter on the window (one list per view). */
  keyboard?: boolean
  label?: string
  empty?: ReactNode
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** Pip-Boy list on the left, detail on the right; the selection bar eases between rows. */
export function ListDetail({ items, selected, onSelect, onActivate, detail, keyboard = true, label, empty }: Props) {
  const listRef = useRef<HTMLUListElement>(null)
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null)
  const index = items.findIndex((i) => i.id === selected)

  useLayoutEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-id="${CSS.escape(selected ?? '')}"]`)
    setBar(row ? { top: row.offsetTop, height: row.offsetHeight } : null)
    row?.scrollIntoView?.({ block: 'nearest' })
  }, [selected, items])

  useEffect(() => {
    if (!keyboard) return
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const enabled = items.filter((i) => !i.disabled)
      if (!enabled.length) return
      const pos = enabled.findIndex((i) => i.id === selected)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const step = e.key === 'ArrowDown' ? 1 : -1
        const next = enabled[(pos + step + enabled.length) % enabled.length]
        onSelect(next.id)
        emit({ type: 'list-move' })
      } else if (e.key === 'Enter' && selected && onActivate && !(e.target instanceof HTMLButtonElement)) {
        onActivate(selected)
        emit({ type: 'list-select' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [keyboard, items, selected, onSelect, onActivate])

  return (
    <div className="list-detail">
      <ul className="pip-list" ref={listRef} role="listbox" aria-label={label} aria-activedescendant={selected ? `row-${selected}` : undefined}>
        {bar && <li className="pip-list__bar" style={{ transform: `translateY(${bar.top}px)`, height: bar.height }} aria-hidden />}
        {items.map((it, i) => (
          <li
            key={it.id}
            id={`row-${it.id}`}
            data-id={it.id}
            role="option"
            aria-selected={i === index}
            aria-disabled={it.disabled}
            className={`pip-row${i === index ? ' is-selected' : ''}${it.disabled ? ' is-disabled' : ''}`}
            onClick={() => {
              if (it.disabled) return
              if (it.id === selected && onActivate) {
                onActivate(it.id)
                emit({ type: 'list-select' })
              } else {
                onSelect(it.id)
                emit({ type: 'list-move' })
              }
            }}
          >
            <span className="pip-row__label">{it.label}</span>
            {it.right != null && <span className="pip-row__right">{it.right}</span>}
          </li>
        ))}
        {!items.length && <li className="pip-row is-disabled">{empty ?? 'NO ENTRIES'}</li>}
      </ul>
      <section className="pip-detail" aria-live="polite">
        {detail}
      </section>
    </div>
  )
}
