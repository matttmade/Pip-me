/**
 * SVG path for the SCREEN-view phosphor rim: a rounded rectangle drawn `offset` px outside the
 * screen, with a gap ("notch") centred on the top and bottom edges for small labels, and short
 * bracket ticks at each gap edge. Pure, so it's unit-tested.
 */
export type RimSpec = { w: number; h: number; radius: number; offset: number; topGap: number; bottomGap: number; tick: number }

const f = (n: number) => Math.round(n * 100) / 100

export function rimPath({ w, h, radius, offset, topGap, bottomGap, tick }: RimSpec): string {
  const x0 = -offset
  const y0 = -offset
  const x1 = w + offset
  const y1 = h + offset
  const r = Math.max(0, Math.min(radius + offset, (x1 - x0) / 2 - 1, (y1 - y0) / 2 - 1))
  const cx = w / 2
  // keep the gaps inside the straight part of each edge
  const maxGap = Math.max(0, x1 - x0 - 2 * r - 2 * tick)
  const tg = Math.min(topGap, maxGap) / 2
  const bg = Math.min(bottomGap, maxGap) / 2
  const right = [
    `M${f(cx + tg)} ${f(y0)}`,
    `L${f(x1 - r)} ${f(y0)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(y0 + r)}`,
    `L${f(x1)} ${f(y1 - r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x1 - r)} ${f(y1)}`,
    `L${f(cx + bg)} ${f(y1)}`,
  ].join(' ')
  const left = [
    `M${f(cx - bg)} ${f(y1)}`,
    `L${f(x0 + r)} ${f(y1)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x0)} ${f(y1 - r)}`,
    `L${f(x0)} ${f(y0 + r)}`,
    `A${f(r)} ${f(r)} 0 0 1 ${f(x0 + r)} ${f(y0)}`,
    `L${f(cx - tg)} ${f(y0)}`,
  ].join(' ')
  // bracket ticks at the notch edges: ┤ LABEL ├
  const ticks = [cx - tg, cx + tg]
    .map((x) => `M${f(x)} ${f(y0 - tick)} L${f(x)} ${f(y0 + tick)}`)
    .concat([cx - bg, cx + bg].map((x) => `M${f(x)} ${f(y1 - tick)} L${f(x)} ${f(y1 + tick)}`))
    .join(' ')
  return `${right} ${left} ${ticks}`
}
