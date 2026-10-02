import type { ReactNode } from 'react'

export function InvDetail({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="inv-detail pip-frame">
      <h2 className="inv-detail__title pip-frame__title">{title}</h2>
      {sub && <p className="inv-detail__sub">{sub}</p>}
      {children}
    </div>
  )
}

export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="inv-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
