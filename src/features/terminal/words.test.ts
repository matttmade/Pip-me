import { describe, expect, it } from 'vitest'
import { WORDS } from './words'

describe('word pools', () => {
  it('has at least 150 seven-letter words', () => {
    expect(WORDS[7].length).toBeGreaterThanOrEqual(150)
  })

  for (const [len, list] of Object.entries(WORDS)) {
    it(`every ${len}-letter word has the right length, is uppercase A-Z and unique`, () => {
      for (const w of list) expect(w).toMatch(new RegExp(`^[A-Z]{${len}}$`))
      expect(new Set(list).size).toBe(list.length)
    })
  }
})
