import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  emit,
  triggerGlitch,
  useCoarsePointer,
  usePrefersReducedMotion,
  useProfile,
  useStored,
  type OverlayProps,
} from '../../lib/contracts'
import {
  addressOf,
  applyAction,
  bracketAt,
  COLS,
  dateKey,
  hex,
  replay,
  ROW_WIDTH,
  ROWS,
  wordAt,
  type HackAction,
  type HackState,
} from './engine'
import { currentStreak, updateStreak } from './streak'
import { useStreak } from './useCaps'

type Mode = 'DAILY' | 'RANDOM'
type DailyRecord = { date: string | null; actions: HackAction[] }
type Target =
  | { kind: 'word'; key: string; from: number; to: number; text: string; action: HackAction }
  | { kind: 'bracket'; key: string; from: number; to: number; text: string; action: HackAction }
  | { kind: 'junk'; key: string; from: number; to: number; text: string; action: null }

const NO_ACTIONS: HackAction[] = []
const EMPTY_DAILY: DailyRecord = { date: null, actions: NO_ACTIONS }
const TYPE_MS = 14
const newSeed = () => `R-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`

function targetAt(s: HackState, i: number): Target {
  const w = wordAt(s, i)
  if (w) {
    return { kind: 'word', key: `w${w.start}`, from: w.start, to: w.start + s.wordLength - 1, text: w.word, action: { t: 'guess', word: w.word } }
  }
  const b = bracketAt(s, i)
  if (b) {
    return { kind: 'bracket', key: `b${b.start}`, from: b.start, to: b.end, text: s.stream.slice(b.start, b.end + 1), action: { t: 'bracket', start: b.start } }
  }
  return { kind: 'junk', key: `j${i}`, from: i, to: i, text: s.stream[i], action: null }
}

/** Grid coordinates: column, row within column, x within row. */
const toPos = (i: number) => {
  const row = Math.floor(i / ROW_WIDTH)
  return { col: Math.floor(row / ROWS), r: row % ROWS, x: i % ROW_WIDTH }
}
const fromPos = (col: number, r: number, x: number) => (col * ROWS + r) * ROW_WIDTH + x

function step(i: number, key: string): number {
  const { col, r, x } = toPos(i)
  if (key === 'ArrowUp') return fromPos(col, Math.max(0, r - 1), x)
  if (key === 'ArrowDown') return fromPos(col, Math.min(ROWS - 1, r + 1), x)
  if (key === 'ArrowLeft') return x > 0 ? i - 1 : col > 0 ? fromPos(col - 1, r, ROW_WIDTH - 1) : i
  if (key === 'ArrowRight') return x < ROW_WIDTH - 1 ? i + 1 : col < COLS - 1 ? fromPos(col + 1, r, 0) : i
  return i
}

/** Reveals `text` one character at a time (instantly with reduced motion). */
function useTyped(text: string, ms = TYPE_MS, delay = 0): string {
  const reduced = usePrefersReducedMotion()
  const [n, setN] = useState(reduced ? text.length : 0)
  useEffect(() => {
    if (reduced) return
    let i = 0
    let id = 0
    const tick = () => {
      i++
      setN(i)
      if (i < text.length) id = window.setTimeout(tick, ms)
    }
    id = window.setTimeout(tick, delay)
    return () => window.clearTimeout(id)
  }, [text, ms, delay, reduced])
  return reduced ? text : text.slice(0, n)
}

function TypedLine({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const shown = useTyped(text, TYPE_MS, delay)
  return (
    <p className={className}>
      {shown || ' '}
      {shown.length < text.length && <span className="cursor">▌</span>}
    </p>
  )
}

export default function Terminal({ onClose }: OverlayProps) {
  const today = useMemo(() => dateKey(), [])
  const coarse = useCoarsePointer()
  const [profile] = useProfile()
  const [mode, setMode] = useStored<Mode>('hack:mode', 'DAILY')
  const [dailyRec, setDailyRec] = useStored<DailyRecord>('hack:daily', EMPTY_DAILY)
  const [streak, setStreak] = useStreak()
  const [randomRun, setRandomRun] = useState<{ seed: string; actions: HackAction[] }>(() => ({ seed: newSeed(), actions: [] }))

  const daily = mode === 'DAILY'
  const seed = daily ? today : randomRun.seed
  const actions = daily ? (dailyRec.date === today ? dailyRec.actions : NO_ACTIONS) : randomRun.actions
  const game = useMemo(() => replay(seed, actions), [seed, actions])

  const [cursor, setCursor] = useState<number>(() => game.words[0]?.start ?? 0)
  const [armed, setArmed] = useState<string | null>(null) // touch: first tap selects, second submits
  const target = targetAt(game, Math.min(cursor, game.stream.length - 1))

  // Result screen: immediate when resuming a finished game, after the log types out otherwise.
  const finished = game.status !== 'playing'
  const [resultFor, setResultFor] = useState<string | null>(finished ? seed : null)
  const showResult = finished && resultFor === seed
  useEffect(() => {
    if (!finished || resultFor === seed) return
    const id = window.setTimeout(() => setResultFor(seed), 1100)
    return () => window.clearTimeout(id)
  }, [finished, resultFor, seed])

  const act = useCallback(
    (action: HackAction | null) => {
      if (!action) return
      const next = applyAction(game, action)
      if (next === game) return
      if (daily) setDailyRec({ date: today, actions: [...actions, action] })
      else setRandomRun((r) => ({ ...r, actions: [...r.actions, action] }))
      setArmed(null)
      if (action.t === 'guess' && next.status !== 'granted') triggerGlitch(0.3)
      if (next.status !== 'playing') {
        emit({ type: 'hack-result', success: next.status === 'granted', daily })
        if (daily && next.status === 'granted') setStreak((s) => updateStreak(s, today))
      }
    },
    [game, daily, today, actions, setDailyRec, setStreak],
  )

  const retry = () => {
    setMode('RANDOM')
    setRandomRun({ seed: newSeed(), actions: [] })
    setResultFor(null)
    setArmed(null)
  }
  const switchMode = (m: Mode) => {
    if (m === mode) return
    setMode(m)
    setArmed(null)
    if (m === 'RANDOM' && randomRun.actions.length) setRandomRun({ seed: newSeed(), actions: [] })
  }

  // Keyboard: arrows move the cursor (skipping across whole words), Enter submits.
  useEffect(() => {
    if (showResult) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        setCursor((c) => {
          const from = targetAt(game, c).key
          let n = step(c, e.key)
          // Horizontal moves hop over the rest of the current word.
          for (let k = 0; k < ROW_WIDTH && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && targetAt(game, n).key === from && targetAt(game, n).kind === 'word'; k++) {
            const m = step(n, e.key)
            if (m === n) break
            n = m
          }
          return n
        })
      } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault()
        act(target.action)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game, target, act, showResult])

  const indexFrom = (e: ReactPointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    return el ? Number(el.dataset.i) : null
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const i = indexFrom(e)
    if (i != null && i !== cursor) setCursor(i)
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    const i = indexFrom(e)
    if (i == null) return
    const t = targetAt(game, i)
    setCursor(i)
    if (e.pointerType === 'mouse') return act(t.action)
    // Touch / pen: tap to select, tap the same target again (or ENTER) to submit.
    if (armed === t.key) act(t.action)
    else setArmed(t.key)
  }

  const cipherLabel = daily ? `DAILY CIPHER ${today}` : `FIELD CIPHER #${seed.slice(-4).toUpperCase()}`
  const streakNow = currentStreak(streak, today)

  return (
    <div className="term">
      <div className="term__bar">
        <div className="term__modes" role="radiogroup" aria-label="Cipher mode">
          {(['DAILY', 'RANDOM'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={`pip-btn${mode === m ? ' is-active' : ''}`} onClick={() => switchMode(m)}>
              {m}
            </button>
          ))}
        </div>
        <span className="term__streak">STREAK {streakNow}</span>
        <button className="pip-btn" onClick={onClose}>
          [ EXIT ]
        </button>
      </div>

      {showResult ? (
        <Result game={game} daily={daily} streak={streakNow} name={profile.name} onRetry={retry} onExit={onClose} />
      ) : (
        <>
          <header className="term__head" key={seed}>
            <TypedLine text="VAULT-TEC SECURE LINK // AUTH REQUIRED" />
            <TypedLine text={`PERSONAL TERMINAL P-3000 :: ${cipherLabel}`} delay={38 * TYPE_MS} />
            <TypedLine text="SUPPLY THE ACCESS PHRASE TO CONTINUE." delay={90 * TYPE_MS} />
          </header>
          <p className="term__attempts" aria-live="polite">
            <span>ATTEMPTS REMAINING</span>
            <span className="term__blocks" aria-label={`${game.attempts} of ${game.maxAttempts}`}>
              {Array.from({ length: game.maxAttempts }, (_, k) => (
                <span key={k} className={k < game.attempts ? 'is-on' : ''} />
              ))}
            </span>
            {game.attempts === 1 && game.status === 'playing' && <span className="term__warn">!! FINAL ATTEMPT - LINK WILL SEAL !!</span>}
          </p>

          <div className="term__body">
            <div
              className="term__grid"
              data-no-swipe
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              aria-label="Memory dump. Arrow keys move, Enter submits."
            >
              {Array.from({ length: COLS }, (_, col) => (
                <div className="term__col" key={col}>
                  {Array.from({ length: ROWS }, (_, r) => {
                    const row = col * ROWS + r
                    const base = row * ROW_WIDTH
                    return (
                      <div className="term__row" key={r}>
                        <span className="term__addr">{hex(addressOf(game, row))}</span>
                        <span className="term__chars">
                          {Array.from(game.stream.slice(base, base + ROW_WIDTH), (ch, x) => {
                            const i = base + x
                            const hl = i >= target.from && i <= target.to
                            return (
                              <span key={x} data-i={i} className={hl ? (armed === target.key ? 'is-hl is-armed' : 'is-hl') : undefined}>
                                {ch}
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <aside className="term__log" aria-live="polite">
              <div className="term__lines">
                {game.log.slice(-18).map((line, k, arr) => (
                  <TypedLine key={`${seed}-${game.log.length - arr.length + k}`} text={line} />
                ))}
              </div>
              <p className="term__prompt">
                &gt;{target.text}
                <span className="cursor">▌</span>
              </p>
              <button
                className="pip-btn term__enter"
                disabled={!target.action || game.status !== 'playing'}
                onClick={() => act(target.action)}
              >
                {coarse ? '[ ENTER ]' : '[ ENTER ] SUBMIT'}
              </button>
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

function Result({
  game,
  daily,
  streak,
  name,
  onRetry,
  onExit,
}: {
  game: HackState
  daily: boolean
  streak: number
  name: string
  onRetry: () => void
  onExit: () => void
}) {
  const ok = game.status === 'granted'
  const exitRef = useRef<HTMLButtonElement>(null)
  useEffect(() => exitRef.current?.focus(), [])
  return (
    <div className={`term__result${ok ? ' is-granted' : ' is-locked'}`} role="status">
      <TypedLine className="term__result-title" text={ok ? 'IDENTITY CONFIRMED' : 'TERMINAL SEALED'} />
      {ok ? (
        <>
          <TypedLine text={`LINK OPEN. WELCOME BACK, ${name || 'DWELLER'}.`} delay={20 * TYPE_MS} />
          <TypedLine text={daily ? `DAILY CIPHER CRACKED. STREAK: ${streak} DAY${streak === 1 ? '' : 'S'}.` : 'FIELD CIPHER CRACKED. NO CAPS AWARDED FOR PRACTICE.'} delay={60 * TYPE_MS} />
        </>
      ) : (
        <>
          <TypedLine text="TOO MANY BAD PHRASES. SECURITY LOCK ENGAGED." delay={20 * TYPE_MS} />
          <TypedLine text={`THE PHRASE WAS ${game.password}. PLEASE CONSULT YOUR OVERSEER.`} delay={64 * TYPE_MS} />
        </>
      )}
      {daily && <TypedLine className="term__note" text="TODAY'S CIPHER IS SPENT. A NEW ONE ARRIVES AT 00:00. RETRY RUNS A FIELD CIPHER." delay={110 * TYPE_MS} />}
      <div className="term__actions">
        <button className="pip-btn" onClick={onRetry}>
          [ RETRY ]
        </button>
        <button className="pip-btn" ref={exitRef} onClick={onExit}>
          [ EXIT ]
        </button>
      </div>
    </div>
  )
}
