type Props = { tabs: readonly string[]; active: number; onChange: (i: number) => void }

export function TopTabs({ tabs, active, onChange }: Props) {
  return (
    <nav className="top-tabs" role="tablist" aria-label="Pip-Boy sections">
      {tabs.map((t, i) => (
        <button
          key={t}
          role="tab"
          id={`tab-${t}`}
          aria-selected={i === active}
          aria-controls="pip-panel"
          tabIndex={i === active ? 0 : -1}
          className={`top-tab${i === active ? ' is-active' : ''}`}
          onClick={() => onChange(i)}
        >
          {t}
        </button>
      ))}
    </nav>
  )
}
