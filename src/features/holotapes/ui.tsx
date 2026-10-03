import type { ReactNode } from 'react'
import { Pictogram, type PictId } from './pictograms'
import { fmtWg, type WgVal } from './weight'

type Stat = [string, ReactNode]

/**
 * Item detail. With `icon` it opens with an FO4-style hero: the pictogram beside
 * a row of stat boxes (WG and VAL from `wgVal`, then any `stats`).
 */
export function InvDetail({
  title,
  sub,
  icon,
  wgVal,
  stats = [],
  children,
}: {
  title: ReactNode
  sub?: ReactNode
  icon?: PictId
  wgVal?: WgVal
  stats?: Stat[]
  children?: ReactNode
}) {
  const boxes: Stat[] = [...(wgVal ? ([['WG', fmtWg(wgVal.wg)], ['VAL', wgVal.val]] as Stat[]) : []), ...stats]
  return (
    <div className="inv-detail pip-frame">
      <h2 className="inv-detail__title pip-frame__title">{title}</h2>
      {sub && <p className="inv-detail__sub">{sub}</p>}
      {icon && (
        <div className="inv-hero">
          <div className="inv-hero__pict">
            <Pictogram id={icon} />
          </div>
          {boxes.length > 0 && (
            <dl className="inv-stats">
              {boxes.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
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

/** The WG / VAL columns on the right of an INV row. */
export function Cols({ wgVal, extra }: { wgVal: WgVal; extra?: ReactNode }) {
  return (
    <span className="inv-cols">
      {extra != null && <span className="inv-cols__extra">{extra}</span>}
      <span>{fmtWg(wgVal.wg)}</span>
      <span>{wgVal.val}</span>
    </span>
  )
}

/** "TITLE (3)": FO4 stack count after the name, only when above one. */
export function Counted({ label, count }: { label: ReactNode; count?: number }) {
  return (
    <>
      {label}
      {count != null && count > 1 && <span className="inv-count"> ({count})</span>}
    </>
  )
}
