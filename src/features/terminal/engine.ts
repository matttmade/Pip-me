/**
 * Pure terminal-hack engine. Deterministic for a given seed: the daily puzzle is
 * createHack(YYYY-MM-DD) and progress can be stored as a list of actions and replayed.
 */
import { randInt, rngFrom, type Rng } from '../../lib/seed'
import { WORDS } from './words'

export const COLS = 2
export const ROWS = 17
export const ROW_WIDTH = 12
export const MAX_ATTEMPTS = 4
export const STREAM_LENGTH = COLS * ROWS * ROW_WIDTH
export const JUNK = `!@#$%^&*()[]{}<>/\\|;:'",.?-_=+`
const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}', '<': '>' }
const MIN_BRACKETS = 4
const RESTORE_CHANCE = 0.2

export type HackStatus = 'playing' | 'locked' | 'granted'
export type Word = { word: string; start: number }
export type BracketPair = { start: number; end: number }
export type HackAction = { t: 'guess'; word: string } | { t: 'bracket'; start: number }
export type HackOptions = { wordLength?: number; count?: number }

export type HackState = {
  seed: string
  wordLength: number
  /** COLS*ROWS*ROW_WIDTH chars: column 0 rows 0..16, then column 1 rows 0..16. */
  stream: string
  startAddress: number
  words: readonly Word[]
  password: string
  attempts: number
  maxAttempts: number
  log: readonly string[]
  status: HackStatus
  /** Duds purged by bracket pairs (shown as dots). */
  removed: ReadonlySet<string>
  /** Start index of every bracket pair already used. */
  usedBrackets: ReadonlySet<number>
  guessed: readonly string[]
}

const isLetter = (c: string) => c >= 'A' && c <= 'Z'

/** Same letter in the same position. */
export function likeness(a: string, b: string): number {
  let n = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) n++
  return n
}

export const rowOf = (i: number) => Math.floor(i / ROW_WIDTH)
export const addressOf = (s: Pick<HackState, 'startAddress'>, row: number) => s.startAddress + row * ROW_WIDTH
export const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`

function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Every unused bracket pair in the current stream: same row, matched, no letters between. */
export function findBrackets(stream: string, used: ReadonlySet<number> = new Set()): BracketPair[] {
  const out: BracketPair[] = []
  for (let i = 0; i < stream.length; i++) {
    const close = PAIRS[stream[i]]
    if (!close || used.has(i)) continue
    const rowEnd = (rowOf(i) + 1) * ROW_WIDTH
    for (let j = i + 1; j < rowEnd && j < stream.length; j++) {
      if (isLetter(stream[j])) break
      if (stream[j] === close) {
        out.push({ start: i, end: j })
        break
      }
    }
  }
  return out
}

/** The live (not purged) candidate word covering stream index i. */
export function wordAt(s: HackState, i: number): Word | undefined {
  return s.words.find((w) => !s.removed.has(w.word) && i >= w.start && i < w.start + s.wordLength)
}

/** The usable bracket pair whose opening or closing char is at i. */
export function bracketAt(s: HackState, i: number): BracketPair | undefined {
  if (s.status !== 'playing') return undefined
  return findBrackets(s.stream, s.usedBrackets).find((p) => p.start === i || p.end === i)
}

export function createHack(seed: string, opts: HackOptions = {}): HackState {
  const wordLength = opts.wordLength ?? 7
  const count = opts.count ?? 12
  const pool = WORDS[wordLength]
  if (!pool || pool.length < count) throw new Error(`no word pool for length ${wordLength}`)
  const slot = Math.floor(STREAM_LENGTH / count)
  if (slot < wordLength + 2) throw new Error('too many words for the grid')

  const rng = rngFrom(`hack|${seed}|${wordLength}|${count}`)
  const startAddress = 0xf000 + randInt(rng, 0, 200) * ROW_WIDTH

  // Password first, then a mix of near misses (likeness >= 2) and random fillers.
  const shuffled = shuffle(pool, rng)
  const password = shuffled[0]
  const rest = shuffled.slice(1)
  const close = rest.filter((w) => likeness(w, password) >= 2).slice(0, Math.floor((count - 1) / 2))
  const fill = rest.filter((w) => !close.includes(w)).slice(0, count - 1 - close.length)
  const chosen = shuffle([password, ...close, ...fill], rng)

  // One word per slot at a random offset, always with junk on both sides.
  const chars: string[] = Array.from({ length: STREAM_LENGTH }, () => JUNK[randInt(rng, 0, JUNK.length - 1)])
  const words: Word[] = chosen.map((word, k) => {
    const start = k * slot + randInt(rng, 1, slot - wordLength - 1)
    for (let c = 0; c < wordLength; c++) chars[start + c] = word[c]
    return { word, start }
  })

  // Guarantee a handful of usable bracket pairs by planting short ones in pure junk.
  const opens = Object.keys(PAIRS)
  for (let tries = 0; tries < 200 && findBrackets(chars.join('')).length < MIN_BRACKETS; tries++) {
    const len = randInt(rng, 2, 5)
    const row = randInt(rng, 0, COLS * ROWS - 1)
    const at = row * ROW_WIDTH + randInt(rng, 0, ROW_WIDTH - len)
    if (chars.slice(at, at + len).some(isLetter)) continue
    const open = opens[randInt(rng, 0, opens.length - 1)]
    chars[at] = open
    chars[at + len - 1] = PAIRS[open]
  }

  return {
    seed,
    wordLength,
    stream: chars.join(''),
    startAddress,
    words,
    password,
    attempts: MAX_ATTEMPTS,
    maxAttempts: MAX_ATTEMPTS,
    log: [],
    status: 'playing',
    removed: new Set(),
    usedBrackets: new Set(),
    guessed: [],
  }
}

export function guess(s: HackState, word: string): HackState {
  if (s.status !== 'playing') return s
  if (!s.words.some((w) => w.word === word) || s.removed.has(word)) return s
  const guessed = [...s.guessed, word]
  if (word === s.password) {
    return { ...s, guessed, status: 'granted', log: [...s.log, `>${word}`, '>PHRASE ACCEPTED.', '>OPENING LINK...'] }
  }
  const attempts = s.attempts - 1
  const log = [...s.log, `>${word}`, '>ACCESS REFUSED.', `>MATCH SCORE=${likeness(word, s.password)}`]
  if (attempts <= 0) return { ...s, guessed, attempts: 0, status: 'locked', log: [...log, '>LINK SEALED.'] }
  return { ...s, guessed, attempts, log }
}

/** Spend a bracket pair: purge one dud, or (sometimes) recharge attempts. Each pair works once. */
export function applyBracket(s: HackState, start: number): HackState {
  if (s.status !== 'playing') return s
  const pair = findBrackets(s.stream, s.usedBrackets).find((p) => p.start === start)
  if (!pair) return s
  const usedBrackets = new Set(s.usedBrackets).add(pair.start)
  const seq = s.stream.slice(pair.start, pair.end + 1)
  const rng = rngFrom(`bracket|${s.seed}|${pair.start}`)
  const duds = s.words.filter((w) => w.word !== s.password && !s.removed.has(w.word))
  const roll = rng()

  if ((roll < RESTORE_CHANCE && s.attempts < s.maxAttempts) || !duds.length) {
    return { ...s, usedBrackets, attempts: s.maxAttempts, log: [...s.log, `>${seq}`, '>ATTEMPTS RECHARGED.'] }
  }
  const dud = duds[randInt(rng, 0, duds.length - 1)]
  const stream = s.stream.slice(0, dud.start) + '.'.repeat(s.wordLength) + s.stream.slice(dud.start + s.wordLength)
  return {
    ...s,
    stream,
    usedBrackets,
    removed: new Set(s.removed).add(dud.word),
    log: [...s.log, `>${seq}`, '>DUD PURGED.'],
  }
}

export const applyAction = (s: HackState, a: HackAction): HackState =>
  a.t === 'guess' ? guess(s, a.word) : applyBracket(s, a.start)

/** Rebuild a game from its seed and the actions taken so far. */
export const replay = (seed: string, actions: readonly HackAction[], opts?: HackOptions): HackState =>
  actions.reduce(applyAction, createHack(seed, opts))

/** Local calendar date as YYYY-MM-DD (the daily seed). */
export function dateKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
