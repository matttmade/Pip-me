/**
 * Original Pip-Me map pictograms: chunky, solid, single-color silhouettes on a 24×24 grid.
 * Drawn for this project (not traced from any game). Rendered as SDF images so MapLibre
 * can tint them with `icon-color` and glow them with `icon-halo-*`.
 */

export type IconId =
  | 'house'
  | 'factory'
  | 'church'
  | 'medical'
  | 'police'
  | 'fuel'
  | 'shop'
  | 'diner'
  | 'bar'
  | 'school'
  | 'library'
  | 'museum'
  | 'theater'
  | 'park'
  | 'monument'
  | 'harbor'
  | 'transit'
  | 'airport'
  | 'fire'
  | 'stadium'
  | 'camp'
  | 'tower'
  | 'caps'
  | 'shelter'
  | 'cemetery'
  | 'landmark'

export type PipIcon = {
  id: IconId
  /** Legend / detail-card label. */
  label: string
  /** SVG path data on a 24×24 grid. */
  path: string
  /** evenodd for icons with cut-outs (windows, doors); nonzero where parts overlap. */
  rule: 'evenodd' | 'nonzero'
}

export const ICON_VIEWBOX = 24

/** Circle as two arcs (for cut-outs and dots). */
const circle = (cx: number, cy: number, r: number) => `M${cx} ${cy - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}Z`

export const ICONS: readonly PipIcon[] = [
  {
    id: 'house',
    label: 'LODGING',
    rule: 'evenodd',
    path: 'M12 2.5 22.5 11.5H19.5V21.5H14.5V15H9.5V21.5H4.5V11.5H1.5Z',
  },
  {
    id: 'factory',
    label: 'WORKSHOP',
    rule: 'evenodd',
    path: 'M1.5 21.5V10.5L7 13.8V10.5L12.5 13.8V10.5L16.5 12.9V2.5H21V21.5Z M4.5 16h2.5v2.5H4.5Z M9.5 16H12v2.5H9.5Z M14.5 16H17v2.5h-2.5Z',
  },
  {
    id: 'church',
    label: 'WORSHIP',
    rule: 'evenodd',
    path: 'M11 1h2v2.5h2.2v2H13v2.6L18.5 13V22.5H14V18.5a2 2 0 0 0-4 0V22.5H5.5V13L11 8.1V5.5H8.8v-2H11Z',
  },
  {
    id: 'medical',
    label: 'MEDICAL',
    rule: 'nonzero',
    path: 'M8.5 2.5h7v6h6v7h-6v6h-7v-6h-6v-7h6Z',
  },
  {
    id: 'police',
    label: 'POLICE',
    rule: 'evenodd',
    path:
      'M12 1.5 20.5 4.8V11C20.5 16.6 17 20.8 12 22.5 7 20.8 3.5 16.6 3.5 11V4.8Z ' +
      'M12 7.2 13.09 10.1 16.18 10.24 13.76 12.17 14.59 15.16 12 13.45 9.41 15.16 10.24 12.17 7.82 10.24 10.91 10.1Z',
  },
  {
    id: 'fuel',
    label: 'FUEL',
    rule: 'evenodd',
    path: 'M3.5 2.5h10.5v19H3.5Z M6 5h5.5v4.5H6Z M14 6h2.6L20 9.4V17.5a2.5 2.5 0 0 1-5 0V14h-1v-2h3v5.5a.5.5 0 0 0 1 0V10.2L15.8 8H14Z',
  },
  {
    id: 'shop',
    label: 'STORE',
    rule: 'evenodd',
    path: 'M4 2.5h16l2 7a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0a2.5 2.5 0 0 1-5 0Z M3.5 13.5h17V21.5h-6V16h-5V21.5h-6Z',
  },
  {
    id: 'diner',
    label: 'FOOD',
    rule: 'nonzero',
    path:
      'M2.5 9h13.5v6a5 5 0 0 1-5 5H7.5a5 5 0 0 1-5-5Z ' +
      'M16 10h2.2a3.3 3.3 0 0 1 0 6.6H15.2l.6-2h2.4a1.3 1.3 0 0 0 0-2.6H16Z ' +
      'M5.5 2.5h1.8v5H5.5Z M9.4 1.5h1.8v6H9.4Z M13.3 2.5h1.8v5h-1.8Z M1.5 21h16v2h-16Z',
  },
  {
    id: 'bar',
    label: 'BAR',
    rule: 'evenodd',
    path: 'M9.8 1.5h4.4v4.6c2.2 1.1 3.3 2.8 3.3 4.9V22.5H6.5V11c0-2.1 1.1-3.8 3.3-4.9Z M8.8 13h6.4v4.5H8.8Z',
  },
  {
    id: 'school',
    label: 'SCHOOL',
    rule: 'nonzero',
    path: 'M12 3.5 23 9 12 14.5 1 9Z M5.5 11.6v4.4c0 1.8 2.9 3.2 6.5 3.2s6.5-1.4 6.5-3.2v-4.4L12 14.9Z M20.6 9.8h1.6v6.5h-1.6Z',
  },
  {
    id: 'library',
    label: 'LIBRARY',
    rule: 'nonzero',
    path: 'M1.5 4.5c3.6-1 7.3-.6 9.7 1.6V21.5C8.8 19.4 5.1 19 1.5 20Z M22.5 4.5c-3.6-1-7.3-.6-9.7 1.6V21.5c2.4-2.1 6.1-2.5 9.7-1.5Z',
  },
  {
    id: 'museum',
    label: 'MUSEUM / CIVIC',
    rule: 'nonzero',
    path: 'M12 1.5 22.5 7.2V9H1.5V7.2Z M3.5 10.5h3.2v8H3.5Z M10.4 10.5h3.2v8h-3.2Z M17.3 10.5h3.2v8h-3.2Z M1.5 20h21v2.5h-21Z',
  },
  {
    id: 'theater',
    label: 'THEATER',
    rule: 'evenodd',
    path: 'M3.5 3h17v8a8.5 8.5 0 0 1-17 0Z M7 7.5h3.5v2.2H7Z M13.5 7.5H17v2.2h-3.5Z M7.8 13.2h8.4a4.2 4.2 0 0 1-8.4 0Z',
  },
  {
    id: 'park',
    label: 'PARK',
    rule: 'nonzero',
    path: 'M12 1.5a6 6 0 0 1 5.9 7.4A5 5 0 0 1 15.2 18.5H13.2V22.5h-2.4V18.5H8.8A5 5 0 0 1 6.1 8.9 6 6 0 0 1 12 1.5Z',
  },
  {
    id: 'monument',
    label: 'MONUMENT',
    rule: 'nonzero',
    path: 'M12 1 14.6 5 15.6 18.8H8.4L9.4 5Z M5.5 19.6h13V22.5h-13Z',
  },
  {
    id: 'harbor',
    label: 'HARBOR',
    rule: 'nonzero',
    path: 'M1.5 14h21l-3.2 7H4.7Z M11 1.5v11H3.5Z M12.6 3.5l7.2 9h-7.2Z',
  },
  {
    id: 'transit',
    label: 'TRANSIT',
    rule: 'evenodd',
    path:
      'M6 1.5h12a3 3 0 0 1 3 3v11.5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V4.5a3 3 0 0 1 3-3Z ' +
      'M5.5 5h13v5.5h-13Z M6 13.5h3v2.4H6Z M15 13.5h3v2.4h-3Z M6 20h3.2l-1.6 3H4.4Z M14.8 20H18l1.6 3h-3.2Z',
  },
  {
    id: 'airport',
    label: 'AIRFIELD',
    rule: 'nonzero',
    path: 'M12 1.2c1 0 1.7 1 1.7 2.5V9l8.6 5.1v2.4l-8.6-2.6v5.2l2.7 2v1.8L12 21.8l-4.4 1.1v-1.8l2.7-2V13.9L1.7 16.5V14.1L10.3 9V3.7C10.3 2.2 11 1.2 12 1.2Z',
  },
  {
    id: 'fire',
    label: 'FIRE STATION',
    rule: 'nonzero',
    path: 'M12 1.2c1 3.6 6.8 6.6 6.8 12.8a6.8 6.8 0 0 1-13.6 0c0-3.1 1.6-4.9 3.1-6.2.2 2.1 1 3.3 2.4 3.8C10 9.2 10 5 12 1.2Z',
  },
  {
    id: 'stadium',
    label: 'SPORTS',
    rule: 'evenodd',
    path:
      'M12 6.5c5.5 0 10.5 2.2 10.5 5v5c0 2.8-5 5-10.5 5S1.5 19.3 1.5 16.5v-5c0-2.8 5-5 10.5-5Z ' +
      'M12 8.8c-4.2 0-7.3 1.2-7.3 2.7s3.1 2.7 7.3 2.7 7.3-1.2 7.3-2.7-3.1-2.7-7.3-2.7Z ' +
      'M11.2 1h1.5v4.5h-1.5Z M12.7 1h3.8l-1.1 1.3 1.1 1.3h-3.8Z',
  },
  {
    id: 'camp',
    label: 'CAMPSITE',
    rule: 'evenodd',
    path: 'M12 2.5 22.8 20.5H1.2Z M12 11.2 16 20.5H8Z M.5 21.5h23V23H.5Z',
  },
  {
    id: 'tower',
    label: 'POST / COMMS',
    rule: 'nonzero',
    path:
      'M12 4 17.2 22.5H14.6L12 12.8 9.4 22.5H6.8Z ' +
      circle(12, 3.2, 2.2) +
      ' M6 3l1.4 1.4a6.3 6.3 0 0 0 0 8.9L6 14.7a8.3 8.3 0 0 1 0-11.7Z' +
      ' M18 3l-1.4 1.4a6.3 6.3 0 0 1 0 8.9L18 14.7a8.3 8.3 0 0 0 0-11.7Z',
  },
  {
    id: 'caps',
    label: 'BANK',
    rule: 'evenodd',
    path:
      'M22.8 12 21.3 13.4 22.32 15.18 20.47 16.08 20.92 18.08 18.89 18.39 18.73 20.44 16.7 20.14 15.95 22.05 14.09 21.16 12.81 22.77 11.3 21.37 9.6 22.53 8.57 20.75 6.6 21.35 6.14 19.35 4.08 19.35 4.23 17.3 2.27 16.69 3.02 14.77 1.32 13.61 2.6 12 1.32 10.39 3.02 9.23 2.27 7.31 4.23 6.7 4.08 4.65 6.14 4.65 6.6 2.65 8.57 3.25 9.6 1.47 11.3 2.63 12.81 1.23 14.09 2.84 15.95 1.95 16.7 3.86 18.73 3.56 18.89 5.61 20.92 5.92 20.47 7.92 22.32 8.82 21.3 10.6Z ' +
      circle(12, 12, 6.6) +
      ' ' +
      circle(12, 12, 3.6),
  },
  {
    id: 'shelter',
    label: 'SHELTER',
    rule: 'evenodd',
    path:
      'M20.04 10.37 22.71 10.6 22.71 13.4 20.04 13.63 18.83 16.53 20.56 18.58 18.58 20.56 16.53 18.83 13.63 20.04 13.4 22.71 10.6 22.71 10.37 20.04 7.47 18.83 5.42 20.56 3.44 18.58 5.17 16.53 3.96 13.63 1.29 13.4 1.29 10.6 3.96 10.37 5.17 7.47 3.44 5.42 5.42 3.44 7.47 5.17 10.37 3.96 10.6 1.29 13.4 1.29 13.63 3.96 16.53 5.17 18.58 3.44 20.56 5.42 18.83 7.47Z ' +
      circle(12, 12, 4.4) +
      ' ' +
      circle(12, 12, 2),
  },
  {
    id: 'cemetery',
    label: 'CEMETERY',
    rule: 'evenodd',
    path: 'M6.5 20.5V8.5a5.5 5.5 0 0 1 11 0V20.5Z M11.2 7.5h1.6v2.2h2.2v1.6h-2.2V16h-1.6v-4.7H9v-1.6h2.2Z M3.5 21.2h17V23h-17Z',
  },
  {
    id: 'landmark',
    label: 'LANDMARK',
    rule: 'evenodd',
    path: 'M12 1.5 22.5 12 12 22.5 1.5 12Z M12 7.2 7.2 12 12 16.8 16.8 12Z',
  },
]

export const ICON_BY_ID: Record<IconId, PipIcon> = Object.fromEntries(ICONS.map((i) => [i.id, i])) as Record<IconId, PipIcon>

/** MapLibre image id for an icon. */
export const iconImageId = (id: IconId) => `pip-i-${id}`
export const ICON_IMAGE_PREFIX = 'pip-i-'

/** Inline SVG markup for an icon (legend, detail card, focus marker). */
export function iconSvg(id: IconId, size = 24, cls = ''): string {
  const i = ICON_BY_ID[id]
  return (
    `<svg class="${cls}" viewBox="0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}" width="${size}" height="${size}" aria-hidden="true">` +
    `<path d="${i.path}" fill="currentColor" fill-rule="${i.rule}"/></svg>`
  )
}
