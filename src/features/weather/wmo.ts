/** WMO weather interpretation codes (as used by Open-Meteo) → Pip-Boy labels. */
const WMO: Record<number, string> = {
  0: 'CLEAR SKIES',
  1: 'MAINLY CLEAR',
  2: 'PARTLY CLOUDY',
  3: 'OVERCAST',
  45: 'FOG',
  48: 'FREEZING FOG',
  51: 'LIGHT DRIZZLE',
  53: 'DRIZZLE',
  55: 'HEAVY DRIZZLE',
  56: 'FREEZING DRIZZLE',
  57: 'FREEZING DRIZZLE',
  61: 'LIGHT RAIN',
  63: 'RAIN',
  65: 'HEAVY RAIN',
  66: 'FREEZING RAIN',
  67: 'FREEZING RAIN',
  71: 'LIGHT SNOW',
  73: 'SNOW',
  75: 'HEAVY SNOW',
  77: 'SNOW GRAINS',
  80: 'RAIN SHOWERS',
  81: 'RAIN SHOWERS',
  82: 'VIOLENT SHOWERS',
  85: 'SNOW SHOWERS',
  86: 'HEAVY SNOW SHOWERS',
  95: 'THUNDERSTORM',
  96: 'THUNDERSTORM + HAIL',
  99: 'THUNDERSTORM + HAIL',
}

export const UNKNOWN_WEATHER = 'ATMOSPHERIC ANOMALY'

export function wmoToLabel(code: number | null | undefined): string {
  return code != null ? (WMO[code] ?? UNKNOWN_WEATHER) : UNKNOWN_WEATHER
}

/** The handful of original icon shapes a WMO code is drawn with. */
export type WmoGlyph = 'clear' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm' | 'unknown'

export function wmoGlyph(code: number | null | undefined): WmoGlyph {
  if (code == null || code < 0) return 'unknown'
  if (code <= 1) return 'clear'
  if (code === 2) return 'partly'
  if (code === 3) return 'cloud'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 95 && code <= 99) return 'storm'
  return 'unknown'
}
