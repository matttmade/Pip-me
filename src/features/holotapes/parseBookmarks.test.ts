import { expect, test } from 'vitest'
import fixture from './__fixtures__/bookmarks.html?raw'
import { domainOf, mergeHolotapes, normalizeUrl, parseBookmarks } from './parseBookmarks'

test('parses links with nested folder paths', () => {
  const tapes = parseBookmarks(fixture)
  const by = Object.fromEntries(tapes.map((t) => [t.title, t]))
  expect(by['MDN Web Docs'].folder).toBe('Bookmarks bar')
  expect(by['GitHub'].folder).toBe('Bookmarks bar / Dev')
  expect(by['React'].folder).toBe('Bookmarks bar / Dev / Docs')
  expect(by['Vite'].folder).toBe('Bookmarks bar / Dev / Docs')
  expect(by['Hacker News'].folder).toBe('Bookmarks bar / Dev')
  expect(by['OpenStreetMap'].folder).toBe('Other bookmarks')
  expect(by['Top level link'].folder).toBe('')
  expect(by['React'].url).toBe('https://react.dev/')
  expect(by['React'].addedAt).toBe(1690000600 * 1000)
})

test('skips javascript:, data:, chrome: and place: links', () => {
  const urls = parseBookmarks(fixture).map((t) => t.url)
  expect(urls.some((u) => /^(javascript|data|chrome|place):/.test(u))).toBe(false)
  expect(urls).toHaveLength(7)
})

test('merges duplicate URLs, keeping the first title and earliest date', () => {
  const gh = parseBookmarks(fixture).filter((t) => t.url === 'https://github.com/')
  expect(gh).toHaveLength(1)
  expect(gh[0].title).toBe('GitHub')
  expect(gh[0].addedAt).toBe(1680000000 * 1000)
})

test('ids are stable and unique', () => {
  const a = parseBookmarks(fixture)
  const b = parseBookmarks(fixture)
  expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id))
  expect(new Set(a.map((t) => t.id)).size).toBe(a.length)
})

test('empty or junk input yields nothing', () => {
  expect(parseBookmarks('')).toEqual([])
  expect(parseBookmarks('<p>hello</p>')).toEqual([])
})

test('mergeHolotapes skips URLs already present', () => {
  const tapes = parseBookmarks(fixture)
  const first = mergeHolotapes([], tapes.slice(0, 3))
  expect(first.added).toBe(3)
  const second = mergeHolotapes(first.list, tapes)
  expect(second.added).toBe(tapes.length - 3)
  expect(second.list).toHaveLength(tapes.length)
})

test('normalizeUrl only accepts http(s)', () => {
  expect(normalizeUrl(' https://a.com ')).toBe('https://a.com/')
  expect(normalizeUrl('ftp://a.com')).toBeNull()
  expect(normalizeUrl('javascript:void 0')).toBeNull()
  expect(normalizeUrl('not a url')).toBeNull()
  expect(domainOf('https://www.example.com/x')).toBe('example.com')
})
