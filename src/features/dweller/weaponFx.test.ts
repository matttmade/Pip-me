import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../../lib/contracts'
import { dropAt, shotLength, spawnSquirt, SPLAT_MS } from './weaponFx'

const size = { w: 800, h: 600 }
const from = { x: 400, y: 300 }

describe('spawnSquirt', () => {
  it('aims the burst to the requested side, above the nozzle', () => {
    for (const dir of [1, -1] as const) {
      const drops = spawnSquirt(mulberry32(7), from, size, dir, 6)
      expect(drops).toHaveLength(6)
      for (const d of drops) {
        expect(Math.sign(d.to.x - from.x)).toBe(dir)
        expect(d.to.y).toBeLessThan(from.y)
      }
    }
  })
  it('staggers the drops', () => {
    const drops = spawnSquirt(mulberry32(1), from, size, 1)
    expect(drops[0].delay).toBe(0)
    expect(drops.every((d, i) => i === 0 || d.delay > drops[i - 1].delay)).toBe(true)
  })
})

describe('dropAt', () => {
  const [d] = spawnSquirt(mulberry32(3), from, size, 1, 1)
  it('waits, flies (growing), splats on target, runs down, then is gone', () => {
    expect(dropAt(d, -1).phase).toBe('wait')
    const early = dropAt(d, d.flight * 0.1)
    const late = dropAt(d, d.flight * 0.9)
    expect(early.phase).toBe('fly')
    expect(late.phase).toBe('fly')
    if (early.phase === 'fly' && late.phase === 'fly') expect(late.r).toBeGreaterThan(early.r)
    const hit = dropAt(d, d.flight)
    expect(hit).toMatchObject({ phase: 'splat', x: d.to.x, y: d.to.y })
    const run = dropAt(d, d.flight + SPLAT_MS * 0.9)
    if (run.phase === 'splat') expect(run.y).toBeGreaterThan(d.to.y)
    expect(dropAt(d, d.flight + SPLAT_MS).phase).toBe('gone')
  })
  it('shotLength covers every drop', () => {
    const drops = spawnSquirt(mulberry32(9), from, size, -1)
    const end = shotLength(drops)
    expect(drops.every((x) => dropAt(x, end).phase === 'gone')).toBe(true)
  })
})
