import type { ListItem } from '../../shell/ListDetail'

/** A non-selectable header row naming the columns; keyboard and clicks skip it. */
export const colHead = (name = 'ITEM'): ListItem => ({
  id: '__cols',
  disabled: true,
  label: <span className="inv-colhead">{name}</span>,
  right: (
    <span className="inv-cols inv-cols--head">
      <span>WG</span>
      <span>VAL</span>
    </span>
  ),
})
