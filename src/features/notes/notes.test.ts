import { describe, expect, it } from 'vitest'
import { BODY_MAX, newNoteId, notesReducer, searchNotes, titleFor, wordCount, type Note } from './notes'

const add = (notes: Note[], id: string, title: string, body: string, now: number) => notesReducer(notes, { type: 'add', id, title, body, now })

describe('notesReducer', () => {
  it('adds newest first and updates move to the top', () => {
    let n = add([], 'a', 'Water', 'Fill the purifier', 1)
    n = add(n, 'b', 'Food', 'Mutfruit x3', 2)
    expect(n.map((x) => x.id)).toEqual(['b', 'a'])
    n = notesReducer(n, { type: 'update', id: 'a', title: 'Water', body: 'Purifier fixed', now: 3 })
    expect(n.map((x) => x.id)).toEqual(['a', 'b'])
    expect(n[0]).toMatchObject({ body: 'Purifier fixed', createdAt: 1, updatedAt: 3 })
  })

  it('returns the same array when nothing changes', () => {
    const n = add([], 'a', 'T', 'B', 1)
    expect(notesReducer(n, { type: 'update', id: 'a', title: 'T', body: 'B', now: 9 })).toBe(n)
    expect(notesReducer(n, { type: 'update', id: 'zz', title: 'T', body: 'B', now: 9 })).toBe(n)
    expect(notesReducer(n, { type: 'delete', id: 'zz' })).toBe(n)
  })

  it('deletes', () => {
    const n = add(add([], 'a', 'A', '', 1), 'b', 'B', '', 2)
    expect(notesReducer(n, { type: 'delete', id: 'a' }).map((x) => x.id)).toEqual(['b'])
  })

  it('clamps body length', () => {
    expect(add([], 'a', 'x', 'y'.repeat(BODY_MAX + 50), 1)[0].body).toHaveLength(BODY_MAX)
  })
})

describe('titleFor', () => {
  it('falls back to the first body line, then a date', () => {
    expect(titleFor('  Hello ', '', 0)).toBe('Hello')
    expect(titleFor('', 'Buy purified water\nand more', 0)).toBe('Buy purified water')
    expect(titleFor('', 'a'.repeat(40), 0)).toHaveLength(32)
    expect(titleFor('', '   ', new Date(2077, 9, 23).getTime())).toBe('ENTRY 10.23')
  })
})

describe('searchNotes', () => {
  const n = add(add([], 'a', 'Water chip', 'Vault 13 needs one', 1), 'b', 'Groceries', 'Water, Cram, Fancy Lads', 2)
  it('matches every word across title and body, case-insensitive', () => {
    expect(searchNotes(n, 'water').map((x) => x.id)).toEqual(['b', 'a'])
    expect(searchNotes(n, 'WATER vault').map((x) => x.id)).toEqual(['a'])
    expect(searchNotes(n, '  ')).toBe(n)
    expect(searchNotes(n, 'deathclaw')).toEqual([])
  })
})

it('counts words and makes ids', () => {
  expect(wordCount('  one two\nthree ')).toBe(3)
  expect(wordCount('')).toBe(0)
  expect(newNoteId(1000, 0.5)).toBe('nrsi0')
})
