/**
 * STATUS > EFFECTS: playful, original "active effects" derived from real state (clock,
 * weather, battery, radio, quests, hack streak). Pure: no React, no storage.
 */

export type EffectTone = 'buff' | 'debuff'
export type StatusEffect = { id: string; name: string; mod: string; note: string; tone: EffectTone }

export type EffectsInput = {
  /** Local hour 0-23. */
  hour: number
  weather: { code: number; temp: number; uv: number; isDay: boolean; units: 'F' | 'C' } | null
  battery: { level: number; charging: boolean }
  radio: { playing: boolean; station: string | null }
  /** Quests completed since local midnight. */
  questsToday: number
  /** Consecutive days the daily terminal was cracked. */
  streak: number
  /** Minutes of daylight left / total today (0/0 when unknown). */
  daylight: { remaining: number; total: number }
}

export const MAX_EFFECTS = 4

const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82])
const SNOW = new Set([71, 73, 75, 77, 85, 86])
const STORM = new Set([95, 96, 99])
const FOG = new Set([45, 48])

function weatherEffect(w: NonNullable<EffectsInput['weather']>): StatusEffect | null {
  if (STORM.has(w.code)) return { id: 'storm', name: 'STORM FRONT', mod: '-1 PER', note: 'Stay under cover', tone: 'debuff' }
  if (SNOW.has(w.code)) return { id: 'snow', name: 'COLD SNAP', mod: '-1 AGI', note: 'Snow on the ground', tone: 'debuff' }
  if (RAIN.has(w.code)) return { id: 'rain', name: 'SOAKED', mod: '-1 AGI', note: 'Rain in the area', tone: 'debuff' }
  if (FOG.has(w.code)) return { id: 'fog', name: 'LOW VISIBILITY', mod: '-2 PER', note: 'Fog rolling in', tone: 'debuff' }
  if (w.code === 3) return { id: 'overcast', name: 'OVERCAST', mod: '-1 PER', note: 'Grey skies', tone: 'debuff' }
  if ((w.code === 0 || w.code === 1) && w.isDay) return { id: 'clear', name: 'CLEAR SKIES', mod: '+1 PER', note: 'Visibility excellent', tone: 'buff' }
  return null
}

function tempEffect(w: NonNullable<EffectsInput['weather']>): StatusEffect | null {
  const f = w.units === 'F' ? w.temp : w.temp * 1.8 + 32
  if (f >= 90) return { id: 'heat', name: 'HEAT WAVE', mod: '-1 END', note: 'Drink purified water', tone: 'debuff' }
  if (f <= 32) return { id: 'freeze', name: 'FREEZING', mod: '-1 END', note: 'Layer up, dweller', tone: 'debuff' }
  return null
}

/** Active effects, most pressing first, capped at `max`. */
export function statusEffects(s: EffectsInput, max = MAX_EFFECTS): StatusEffect[] {
  const out: (StatusEffect | null)[] = []
  const { level, charging } = s.battery

  if (charging) out.push({ id: 'charging', name: 'RECHARGING', mod: '+1 END', note: 'Plugged into the grid', tone: 'buff' })
  else if (level < 0.2) out.push({ id: 'low-power', name: 'LOW POWER', mod: '-2 AGI', note: `Battery at ${Math.round(level * 100)}%`, tone: 'debuff' })

  if (s.weather) {
    out.push(weatherEffect(s.weather))
    out.push(tempEffect(s.weather))
    if (s.weather.uv >= 6) out.push({ id: 'rads', name: 'HIGH RADS', mod: '-1 END', note: `UV index ${s.weather.uv}`, tone: 'debuff' })
  }

  if (s.radio.playing) out.push({ id: 'radio', name: 'TUNED IN', mod: '+1 CHA', note: s.radio.station ?? 'Radio on', tone: 'buff' })

  if (s.questsToday > 0)
    out.push({
      id: 'quests',
      name: 'PRODUCTIVE',
      mod: `+${Math.min(3, s.questsToday)} INT`,
      note: `${s.questsToday} quest${s.questsToday === 1 ? '' : 's'} done today`,
      tone: 'buff',
    })

  if (s.streak >= 2) out.push({ id: 'streak', name: 'HOT STREAK', mod: '+1 LCK', note: `${s.streak} day hack streak`, tone: 'buff' })

  const { remaining, total } = s.daylight
  if (total > 0 && remaining > 0 && remaining <= 60)
    out.push({ id: 'golden', name: 'GOLDEN HOUR', mod: '+1 CHA', note: `${remaining}M of daylight left`, tone: 'buff' })

  const h = s.hour
  if (h >= 22 || h < 4) out.push({ id: 'night-owl', name: 'NIGHT OWL', mod: '+1 PER', note: 'Sharper after dark', tone: 'buff' })
  else if (h < 9) out.push({ id: 'early', name: 'EARLY RISER', mod: '+1 END', note: 'Up before the wasteland', tone: 'buff' })
  else if (h >= 13 && h < 15) out.push({ id: 'slump', name: 'AFTERNOON SLUMP', mod: '-1 INT', note: 'Coffee recommended', tone: 'debuff' })

  return out.filter((e): e is StatusEffect => !!e).slice(0, Math.max(0, max))
}

/** Count of quests completed since local midnight of `now`. */
export function questsDoneToday(quests: readonly { completedAt?: number }[], now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return quests.filter((q) => q.completedAt != null && q.completedAt >= midnight && q.completedAt <= now.getTime()).length
}
