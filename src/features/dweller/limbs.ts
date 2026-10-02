import { rngFrom } from '../../lib/contracts'

export const LIMBS = ['HEAD', 'L ARM', 'R ARM', 'TORSO', 'L LEG', 'R LEG'] as const
export type Limb = (typeof LIMBS)[number]

/** Decorative limb condition (0.55-1), seeded from the dweller name so it is stable. */
export function limbCondition(name: string): Record<Limb, number> {
  const rng = rngFrom(`limbs:${name.trim().toUpperCase()}`)
  const out = {} as Record<Limb, number>
  for (const limb of LIMBS) out[limb] = Math.round((0.55 + rng() * 0.45) * 100) / 100
  return out
}
