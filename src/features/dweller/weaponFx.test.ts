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

describe('squirt facing', () => {
  it('without a facing it is the classic at-the-glass burst', () => {
    const a = spawnSquirt(mulberry32(5), from, size, 1, 3)
    const b = spawnSquirt(mulberry32(5), from, size, 1, 3, { x: 1, z: 1 })
    expect(b.map((d) => d.to)).toEqual(a.map((d) => d.to))
    expect(a.every((d) => d.depth === 1)).toBe(true)
  })
  it('shot away from the viewer: lands short, shrinks in flight, never splats', () => {
    const near = spawnSquirt(mulberry32(9), from, size, -1, 4, { x: -0.3, z: 1 })
    const far = spawnSquirt(mulberry32(9), from, size, -1, 4, { x: -0.3, z: -1 })
    far.forEach((d, i) => {
      expect(Math.sign(d.to.x - from.x)).toBe(-1)
      expect(Math.abs(d.to.x - from.x)).toBeLessThan(Math.abs(near[i].to.x - from.x))
    })
    const [d] = far
    const a = dropAt(d, d.delay + d.flight * 0.1)
    const b = dropAt(d, d.delay + d.flight * 0.9)
    if (a.phase !== 'fly' || b.phase !== 'fly') throw new Error('expected flight')
    expect(b.r).toBeLessThan(a.r)
    expect(dropAt(d, d.delay + d.flight + 1).phase).toBe('gone')
    expect(shotLength([d])).toBe(d.delay + d.flight)
  })
  it('side-on shots still reach out sideways', () => {
    for (const d of spawnSquirt(mulberry32(2), from, size, 1, 4, { x: 1, z: 0 })) expect(d.to.x - from.x).toBeGreaterThan(size.w * 0.2)
  })
})
