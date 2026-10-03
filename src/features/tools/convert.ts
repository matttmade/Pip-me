/** Unit conversion. Linear units carry a factor to the category's base unit; temperature is special-cased. */

export type Unit = { id: string; label: string; factor?: number }
export type Category = { id: string; label: string; units: Unit[]; from: string; to: string }

export const CATEGORIES: Category[] = [
  {
    id: 'length',
    label: 'LENGTH',
    from: 'mi',
    to: 'km',
    units: [
      { id: 'mm', label: 'MM', factor: 0.001 },
      { id: 'cm', label: 'CM', factor: 0.01 },
      { id: 'm', label: 'M', factor: 1 },
      { id: 'km', label: 'KM', factor: 1000 },
      { id: 'in', label: 'IN', factor: 0.0254 },
      { id: 'ft', label: 'FT', factor: 0.3048 },
      { id: 'yd', label: 'YD', factor: 0.9144 },
      { id: 'mi', label: 'MI', factor: 1609.344 },
    ],
  },
  {
    id: 'mass',
    label: 'MASS',
    from: 'lb',
    to: 'kg',
    units: [
      { id: 'g', label: 'G', factor: 0.001 },
      { id: 'kg', label: 'KG', factor: 1 },
      { id: 'oz', label: 'OZ', factor: 0.028349523125 },
      { id: 'lb', label: 'LB', factor: 0.45359237 },
      { id: 'st', label: 'ST', factor: 6.35029318 },
    ],
  },
  {
    id: 'temp',
    label: 'TEMP',
    from: 'F',
    to: 'C',
    units: [
      { id: 'C', label: '°C' },
      { id: 'F', label: '°F' },
      { id: 'K', label: 'K' },
    ],
  },
  {
    id: 'volume',
    label: 'VOLUME',
    from: 'cup',
    to: 'ml',
    units: [
      { id: 'ml', label: 'ML', factor: 0.001 },
      { id: 'l', label: 'L', factor: 1 },
      { id: 'tsp', label: 'TSP', factor: 0.00492892159375 },
      { id: 'tbsp', label: 'TBSP', factor: 0.0147867647813 },
      { id: 'floz', label: 'FL OZ', factor: 0.0295735295625 },
      { id: 'cup', label: 'CUP', factor: 0.2365882365 },
      { id: 'pt', label: 'PINT', factor: 0.473176473 },
      { id: 'gal', label: 'GAL', factor: 3.785411784 },
    ],
  },
  {
    id: 'speed',
    label: 'SPEED',
    from: 'mph',
    to: 'kmh',
    units: [
      { id: 'ms', label: 'M/S', factor: 1 },
      { id: 'kmh', label: 'KM/H', factor: 1 / 3.6 },
      { id: 'mph', label: 'MPH', factor: 0.44704 },
      { id: 'kn', label: 'KNOT', factor: 1852 / 3600 },
    ],
  },
  {
    id: 'data',
    label: 'DATA',
    from: 'gb',
    to: 'mb',
    units: [
      { id: 'b', label: 'BYTE', factor: 1 },
      { id: 'kb', label: 'KB', factor: 1e3 },
      { id: 'mb', label: 'MB', factor: 1e6 },
      { id: 'gb', label: 'GB', factor: 1e9 },
      { id: 'tb', label: 'TB', factor: 1e12 },
    ],
  },
]

export const categoryOf = (id: string) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0]

function toKelvin(v: number, u: string) {
  return u === 'C' ? v + 273.15 : u === 'F' ? ((v - 32) * 5) / 9 + 273.15 : v
}
function fromKelvin(k: number, u: string) {
  return u === 'C' ? k - 273.15 : u === 'F' ? ((k - 273.15) * 9) / 5 + 32 : k
}

/** Convert `value` between two units of one category. NaN for unknown units. */
export function convert(value: number, category: string, from: string, to: string): number {
  const cat = categoryOf(category)
  if (cat.id === 'temp') return fromKelvin(toKelvin(value, from), to)
  const a = cat.units.find((u) => u.id === from)?.factor
  const b = cat.units.find((u) => u.id === to)?.factor
  if (a == null || b == null) return NaN
  return (value * a) / b
}

/** Readable number: up to 6 significant digits, no float noise, exponent for extremes. */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return 'ERR'
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e12 || abs < 1e-6) return n.toExponential(4).replace(/\.?0+e/, 'e').toUpperCase()
  const s = Number(n.toPrecision(abs >= 1e6 ? 12 : 6)).toString()
  return s
}
