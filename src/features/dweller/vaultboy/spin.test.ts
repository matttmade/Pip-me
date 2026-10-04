import { describe, expect, it } from 'vitest'
import { coastStep, COAST_MAX, DRAG_TURN, dragToAngle, facingFromYaw, releaseVelocity, squirtAim, wrapAngle } from './spin'

describe('wrapAngle', () => {
  it('wraps into (-π, π]', () => {
    expect(wrapAngle(0)).toBe(0)
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI)
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI)
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI)
    expect(wrapAngle(Math.PI / 2 + 4 * Math.PI)).toBeCloseTo(Math.PI / 2)
    expect(wrapAngle(-Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(-Math.PI / 2)
  })
  it('treats garbage as 0', () => {
    expect(wrapAngle(NaN)).toBe(0)
  })
})

describe('dragToAngle', () => {
  it('maps a full-width drag to DRAG_TURN, signed by direction', () => {
    expect(dragToAngle(200, 200)).toBeCloseTo(DRAG_TURN)
    expect(dragToAngle(-100, 200)).toBeCloseTo(-DRAG_TURN / 2)
  })
  it('is 0 for a zero-size figure', () => {
    expect(dragToAngle(50, 0)).toBe(0)
  })
})

describe('releaseVelocity', () => {
  it('measures the recent flick in rad/s', () => {
    const v = releaseVelocity(
      [
        { x: 0, t: 0 },
        { x: 20, t: 50 },
        { x: 40, t: 100 },
      ],
      200,
    )
    expect(v).toBeCloseTo(dragToAngle(40, 200) / 0.1)
  })
  it('ignores samples older than the window (a pause means no coast)', () => {
    expect(
      releaseVelocity(
        [
          { x: 0, t: 0 },
          { x: 100, t: 10 },
          { x: 100, t: 400 },
        ],
        200,
      ),
    ).toBe(0)
  })
  it('clamps wild flicks', () => {
    expect(
      releaseVelocity(
        [
          { x: 0, t: 0 },
          { x: 900, t: 5 },
        ],
        100,
      ),
    ).toBe(COAST_MAX)
  })
  it('needs two samples', () => {
    expect(releaseVelocity([{ x: 5, t: 0 }], 100)).toBe(0)
  })
})

describe('coastStep', () => {
  it('turns in the direction of travel and slows down', () => {
    const s = coastStep(4, 1 / 30)
    expect(s.turn).toBeGreaterThan(0)
    expect(s.turn).toBeLessThan(4 / 30)
    expect(s.vel).toBeLessThan(4)
    expect(s.vel).toBeGreaterThan(0)
  })
  it('settles to a full stop, never reversing', () => {
    let v = -6
    let total = 0
    for (let i = 0; i < 300 && v !== 0; i++) {
      const s = coastStep(v, 1 / 30)
      total += s.turn
      expect(Math.sign(s.vel) === Math.sign(v) || s.vel === 0).toBe(true)
      v = s.vel
    }
    expect(v).toBe(0)
    expect(total).toBeLessThan(0)
  })
  it('does nothing with no time or no speed', () => {
    expect(coastStep(3, 0)).toEqual({ turn: 0, vel: 3 })
    expect(coastStep(0.01, 0.1)).toEqual({ turn: 0, vel: 0 })
  })
})

describe('facing + squirt aim', () => {
  it('is relative to the camera orbit', () => {
    expect(facingFromYaw(0.5, 0.5)).toBeCloseTo(0)
    expect(facingFromYaw(Math.PI / 2 + 0.2, 0.2)).toBeCloseTo(Math.PI / 2)
  })
  it('facing the viewer shoots at the glass', () => {
    const a = squirtAim(0)
    expect(a.z).toBeCloseTo(1)
    expect(a.x).toBeCloseTo(0)
  })
  it('facing right / left shoots sideways', () => {
    expect(squirtAim(Math.PI / 2).x).toBeCloseTo(1)
    expect(squirtAim(-Math.PI / 2).x).toBeCloseTo(-1)
  })
  it('facing away shoots into the screen', () => {
    expect(squirtAim(Math.PI).z).toBeCloseTo(-1)
  })
})
