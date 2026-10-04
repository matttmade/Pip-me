import { describe, expect, it } from 'vitest'
import {
  applyBracket,
  createHack,
  dateKey,
  findBrackets,
  guess,
  likeness,
  MAX_ATTEMPTS,
  replay,
  ROW_WIDTH,
  STREAM_LENGTH,
  wordAt,
  type HackState,
} from './engine'
import { currentStreak, EMPTY_STREAK, prevDay, updateStreak } from './streak'

const duds = (s: HackState) => s.words.map((w) => w.word).filter((w) => w !== s.password)

describe('likeness', () => {
  it('counts same letters in the same positions', () => {
    expect(likeness('CONTROL', 'CONTROL')).toBe(7)
    expect(likeness('CONTROL', 'CONTENT')).toBe(4)
    expect(likeness('ABCDEFG', 'GFEDCBA')).toBe(1)
    expect(likeness('AAAAAAA', 'BBBBBBB')).toBe(0)
  })
})

describe('createHack', () => {
  const s = createHack('2026-10-02')

  it('builds the grid with embedded, non-overlapping words', () => {
    expect(s.stream).toHaveLength(STREAM_LENGTH)
    expect(s.words).toHaveLength(12)
    expect(s.words.map((w) => w.word)).toContain(s.password)
    const sorted = [...s.words].sort((a, b) => a.start - b.start)
    sorted.forEach((w, i) => {
      expect(s.stream.slice(w.start, w.start + 7)).toBe(w.word)
      if (i > 0) expect(w.start).toBeGreaterThan(sorted[i - 1].start + 7)
    })
    const letters = s.stream.replace(/[^A-Z]/g, '')
    expect(letters).toHaveLength(12 * 7)
    expect(s.attempts).toBe(MAX_ATTEMPTS)
    expect(s.status).toBe('playing')
    expect(s.startAddress % 1).toBe(0)
  })

  it('is deterministic per seed (daily puzzle)', () => {
    const again = createHack('2026-10-02')
    expect(again.stream).toBe(s.stream)
    expect(again.password).toBe(s.password)
    expect(again.startAddress).toBe(s.startAddress)
    expect(createHack('2026-10-03').stream).not.toBe(s.stream)
  })

  it('supports other word lengths', () => {
    const five = createHack('x', { wordLength: 5, count: 10 })
    expect(five.password).toHaveLength(5)
    expect(five.words).toHaveLength(10)
  })

  it('always plants some usable bracket pairs', () => {
    for (const seed of ['a', 'b', 'c', '2026-01-01', '2027-12-31']) {
      expect(findBrackets(createHack(seed).stream).length).toBeGreaterThanOrEqual(4)
    }
  })

  it('wordAt maps any char of a word to that word', () => {
    const w = s.words[3]
    expect(wordAt(s, w.start)?.word).toBe(w.word)
    expect(wordAt(s, w.start + 6)?.word).toBe(w.word)
    expect(wordAt(s, w.start - 1)).toBeUndefined()
  })
})

describe('guess', () => {
  it('reports likeness and spends an attempt on a miss', () => {
    const s = createHack('miss')
    const wrong = duds(s)[0]
    const next = guess(s, wrong)
    expect(next.attempts).toBe(MAX_ATTEMPTS - 1)
    expect(next.status).toBe('playing')
    expect(next.log).toContain(`>${wrong}`)
    expect(next.log).toContain(`>MATCH SCORE=${likeness(wrong, s.password)}`)
  })

  it('grants access on the password', () => {
    const s = createHack('win')
    const next = guess(guess(s, duds(s)[0]), s.password)
    expect(next.status).toBe('granted')
    expect(guess(next, duds(s)[1])).toBe(next) // finished games ignore input
  })

  it('locks out after four misses', () => {
    let s = createHack('lose')
    for (const w of duds(s).slice(0, 4)) s = guess(s, w)
    expect(s.status).toBe('locked')
    expect(s.attempts).toBe(0)
    expect(guess(s, s.password).status).toBe('locked')
  })

  it('ignores words that are not on the grid', () => {
    const s = createHack('noop')
    expect(guess(s, 'ZZZZZZZ')).toBe(s)
  })
})

describe('bracket pairs', () => {
  const blank = (row: string, at = 0) => {
    const chars = '.'.repeat(STREAM_LENGTH).split('')
    for (let i = 0; i < row.length; i++) chars[at + i] = row[i]
    return chars.join('')
  }

  it('detects matched pairs within a row with no letters between', () => {
    expect(findBrackets(blank('(..)'))).toEqual([{ start: 0, end: 3 }])
    expect(findBrackets(blank('[#]<>{;}'))).toEqual([
      { start: 0, end: 2 },
      { start: 3, end: 4 },
      { start: 5, end: 7 },
    ])
    expect(findBrackets(blank('(A)'))).toEqual([]) // letters block
    expect(findBrackets(blank('(]'))).toEqual([]) // mismatched
    expect(findBrackets(blank('(.', ROW_WIDTH - 2) + '')).toEqual([]) // no wrap across rows
    expect(findBrackets(blank('..)(', 0))).toEqual([]) // close before open
  })

  it('skips used pairs', () => {
    expect(findBrackets(blank('()<>'), new Set([0]))).toEqual([{ start: 2, end: 3 }])
  })

  it('each pair works once, and dud removal never removes the password', () => {
    for (const seed of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']) {
      let s = createHack(seed)
      s = guess(s, duds(s)[0]) // spend an attempt so a recharge is visible
      let guard = 0
      while (findBrackets(s.stream, s.usedBrackets).length && guard++ < 100) {
        const pair = findBrackets(s.stream, s.usedBrackets)[0]
        const next = applyBracket(s, pair.start)
        expect(next.usedBrackets.has(pair.start)).toBe(true)
        expect(applyBracket(next, pair.start)).toBe(next)
        expect(next.removed.has(s.password)).toBe(false)
        expect(next.stream).toContain(s.password)
        s = next
      }
    }
  })

  it('purges a dud by replacing it with dots, or recharges attempts', () => {
    let saw = { purge: false, recharge: false }
    for (let k = 0; k < 40; k++) {
      let s = createHack(`mix${k}`)
      s = guess(s, duds(s)[0])
      const pair = findBrackets(s.stream)[0]
      const next = applyBracket(s, pair.start)
      if (next.removed.size) {
        saw = { ...saw, purge: true }
        const gone = [...next.removed][0]
        const w = s.words.find((x) => x.word === gone)!
        expect(next.stream.slice(w.start, w.start + 7)).toBe('.......')
        expect(wordAt(next, w.start)).toBeUndefined()
        expect(guess(next, gone)).toBe(next)
      } else {
        saw = { ...saw, recharge: true }
        expect(next.attempts).toBe(MAX_ATTEMPTS)
      }
    }
    expect(saw).toEqual({ purge: true, recharge: true })
  })
})

describe('replay', () => {
  it('rebuilds the same state from actions', () => {
    const s0 = createHack('2026-10-02')
    const pair = findBrackets(s0.stream)[0]
    const actions = [{ t: 'guess', word: duds(s0)[2] }, { t: 'bracket', start: pair.start }] as const
    const direct = applyBracket(guess(s0, duds(s0)[2]), pair.start)
    const replayed = replay('2026-10-02', actions)
    expect(replayed.stream).toBe(direct.stream)
    expect(replayed.attempts).toBe(direct.attempts)
    expect(replayed.log).toEqual(direct.log)
  })
})

describe('dateKey', () => {
  it('formats the local date', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('streak', () => {
  it('finds the previous day across month and year edges', () => {
    expect(prevDay('2026-10-02')).toBe('2026-10-01')
    expect(prevDay('2026-03-01')).toBe('2026-02-28')
    expect(prevDay('2027-01-01')).toBe('2026-12-31')
  })

  it('increments on consecutive days, resets after a gap, ignores repeats', () => {
    let s = updateStreak(EMPTY_STREAK, '2026-10-01')
    expect(s).toEqual({ count: 1, lastDate: '2026-10-01' })
    s = updateStreak(s, '2026-10-02')
    expect(s.count).toBe(2)
    expect(updateStreak(s, '2026-10-02')).toBe(s)
    expect(updateStreak(s, '2026-10-05')).toEqual({ count: 1, lastDate: '2026-10-05' })
  })

  it('lapses to zero once a day is skipped', () => {
    const s = { count: 3, lastDate: '2026-10-02' }
    expect(currentStreak(s, '2026-10-02')).toBe(3)
    expect(currentStreak(s, '2026-10-03')).toBe(3)
    expect(currentStreak(s, '2026-10-04')).toBe(0)
    expect(currentStreak(EMPTY_STREAK, '2026-10-04')).toBe(0)
  })
})
