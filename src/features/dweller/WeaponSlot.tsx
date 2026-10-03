import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { mulberry32, useOverlay, usePrefersReducedMotion, useStored, type Rng } from '../../lib/contracts'
import { requestEmote } from './emotes'
import { onFigureTap } from './figureTap'
import { DropGlyph, WeaponGlyph } from './glyphs'
import NukeBlast from './NukeBlast'
import { WeaponFxLayer, type WeaponFxHandle } from './WeaponFxLayer'
import {
  confirmLeft,
  cycleWeapon,
  DEFAULT_WEAPON,
  isReloading,
  normalizeWeapon,
  pressNuke,
  settle,
  squirt,
  WEAPON_KEY,
  weaponById,
  WEAPONS,
  type WeaponState,
} from './weapons'
import type { Pt } from './weaponFx'
import { weaponSfx } from './weaponSfx'

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))

/** Brief shake of the CRT contents (the tube), for a punch. */
function shake(el: Element | null | undefined, px: number, ms: number) {
  if (!el || typeof (el as HTMLElement).animate !== 'function') return
  const frames = Array.from({ length: 7 }, (_, i) => {
    const k = i === 0 || i === 6 ? 0 : (1 - i / 7) * px
    return { transform: `translate(${(i % 2 ? 1 : -1) * k}px, ${(i % 3 === 1 ? -1 : 1) * k * 0.6}px)` }
  })
  ;(el as HTMLElement).animate(frames, { duration: ms, easing: 'ease-out' })
}

/**
 * STATUS weapon slot (FO4's weapon box, made ours). Tap / Enter / Space / W swaps
 * FIST → WATER PISTOL → NUKE. With the NUKE equipped, a tap arms it and a second tap within
 * three seconds launches (the app blows up and reboots). The equipped weapon also decides
 * what a tap on the figure does: FIST punches the glass, WATER PISTOL squirts it.
 */
export function WeaponSlot() {
  const [stored, setStored] = useStored<WeaponState>(WEAPON_KEY, DEFAULT_WEAPON)
  const state = normalizeWeapon(stored)
  // the confirm window is never persisted (normalizeWeapon drops it), so it lives here
  const [confirmUntil, setConfirmUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [launched, setLaunched] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [kick, setKick] = useState(0)
  const reduced = usePrefersReducedMotion()
  const overlay = useOverlay()
  const box = useRef<HTMLButtonElement>(null)
  const [crt, setCrt] = useState<HTMLElement | null>(null)
  const fx = useRef<WeaponFxHandle>(null)
  const rng = useRef<Rng | null>(null)
  const side = useRef<1 | -1>(1)
  const noteTimer = useRef(0)

  const full: WeaponState = { ...state, confirmUntil }
  const weapon = weaponById(full.id)
  const reloading = isReloading(full, now)
  const left = confirmLeft(full, now)

  useLayoutEffect(() => {
    setCrt((box.current?.closest('.crt') as HTMLElement | null) ?? (box.current?.closest('.status-panel') as HTMLElement | null) ?? null)
  }, [])

  const flash = (text: string, ms = 1100) => {
    setNote(text)
    window.clearTimeout(noteTimer.current)
    noteTimer.current = window.setTimeout(() => setNote(null), ms)
  }
  useEffect(() => () => window.clearTimeout(noteTimer.current), [])

  const commit = (s: WeaponState) => {
    setConfirmUntil(s.confirmUntil)
    setStored({ ...s, confirmUntil: null })
    setNow(Date.now())
  }

  // Refill timer, and the confirm countdown (ticks, then stands down to FIST).
  useEffect(() => {
    if (full.reloadAt == null && confirmUntil == null) return
    const id = window.setInterval(() => {
      const t = Date.now()
      setNow(t)
      const s = settle(full, t)
      if (s === full) return
      if (full.reloadAt != null && s.reloadAt == null) weaponSfx.reload()
      if (confirmUntil != null && s.confirmUntil == null) {
        weaponSfx.swap()
        flash('STAND DOWN')
      }
      commit(s)
    }, 200)
    return () => window.clearInterval(id)
  })

  const launch = () => setLaunched(true)

  const nuke = (s: WeaponState) => {
    const r = pressNuke(s, Date.now())
    commit(r.state)
    if (r.result === 'launch') return launch()
    weaponSfx.arm()
    setKick((k) => k + 1)
  }

  /** The weapon box: swap, or work the nuke's two-tap launch. */
  const press = () => {
    if (launched) return
    if (full.id === 'nuke') return nuke(full)
    commit(cycleWeapon(full))
    weaponSfx.swap()
    setKick((k) => k + 1)
    if (full.id === 'water') weaponSfx.arm()
  }

  /** W key: plain swap through all three, never launches. */
  const swapOnly = () => {
    if (launched) return
    const next = cycleWeapon(full)
    commit(next)
    weaponSfx.swap()
    setKick((k) => k + 1)
    if (next.id === 'nuke') weaponSfx.arm()
  }

  /** Where the figure is on screen. Vault Boy's 'point' gesture aims screen-left, so his
   *  shots leave from that hand; the other figures squirt from the chest, either way. */
  const figure = (): { from: Pt; mid: number; w: number; pointsLeft: boolean } | null => {
    const scene = box.current?.closest('.status-panel')?.querySelector('.dweller-scene, .paper-doll svg')
    if (!scene) return null
    const r = scene.getBoundingClientRect()
    const mid = r.left + r.width / 2
    return { from: { x: mid, y: r.top + r.height * 0.45 }, mid, w: r.width, pointsLeft: scene.classList.contains('vaultboy-scene') }
  }

  /** A tap on the figure, offered by the scene. */
  const fire = (at: Pt | null): boolean => {
    if (launched) return true
    const t = Date.now()
    const s = settle(full, t)
    if (s.id === 'fist') {
      requestEmote('flex')
      weaponSfx.punch()
      const c = figure()
      const p = at ?? c?.from
      if (p) fx.current?.punch(p)
      if (!reduced) shake(crt?.querySelector('.crt__tube') ?? crt, 5, 280)
      return true
    }
    if (s.id === 'water') {
      const r = squirt(s, t)
      commit(r.state)
      if (r.shot === 'dry') {
        weaponSfx.dry()
        flash(r.state.reloadAt != null ? 'RELOADING' : 'EMPTY', 700)
        return true
      }
      requestEmote('point')
      weaponSfx.squirt()
      const c = figure()
      if (c) {
        rng.current ??= mulberry32(t | 0)
        const dir: 1 | -1 = c.pointsLeft ? -1 : at ? (at.x < c.mid ? -1 : 1) : (side.current = side.current === 1 ? -1 : 1)
        fx.current?.squirt({ x: c.from.x + dir * c.w * (c.pointsLeft ? 0.22 : 0.08), y: c.from.y }, dir, rng.current, reduced)
      }
      if (r.state.ammo === 0) flash('RELOAD', 1500)
      return true
    }
    // NUKE: a figure tap works the same two-tap launch as the box
    nuke(s)
    return true
  }
  const fireRef = useRef(fire)
  const swapRef = useRef(swapOnly)
  useLayoutEffect(() => {
    fireRef.current = fire
    swapRef.current = swapOnly
  })
  useEffect(() => onFigureTap((at) => fireRef.current(at)), [])

  useEffect(() => {
    if (overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.key.toLowerCase() !== 'w') return
      e.preventDefault()
      swapRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay])

  const mag = WEAPONS[1].mag ?? 0
  const armed = full.id === 'nuke' && left > 0
  const status = full.id === 'nuke' ? (launched ? 'LAUNCHED' : armed ? `TAP AGAIN TO LAUNCH · ${left}` : 'ARMED · TAP TO LAUNCH') : null
  const label =
    full.id === 'water'
      ? `Weapon: water pistol, ${reloading ? 'reloading' : `${full.ammo} of ${mag} water`}. Tap to swap.`
      : full.id === 'nuke'
        ? `Weapon: mini nuke. ${armed ? 'Tap again to launch.' : 'Tap to arm, then tap again within 3 seconds to launch.'} Press W to swap instead.`
        : 'Weapon: fist, damage 2. Tap to swap.'

  return (
    <>
      <button
        ref={box}
        type="button"
        className={`weapon weapon--${full.id}${armed ? ' is-armed' : ''}${reloading ? ' is-reloading' : ''}${launched ? ' is-launched' : ''}`}
        data-no-swipe
        onClick={press}
        aria-label={label}
        title={full.id === 'nuke' ? 'Tap twice to launch  [W: swap]' : 'Tap to swap weapon  [W]'}
      >
        <span className="weapon__legend" aria-hidden>
          WEAPON
        </span>
        <span key={`${full.id}-${kick}`} className="weapon__icon" aria-hidden>
          <WeaponGlyph id={full.id} />
        </span>
        <span className="weapon__body" aria-hidden>
          <span className="weapon__name">
            <span className="weapon__long">{weapon.name}</span>
            <span className="weapon__short">{weapon.short}</span>
          </span>
          {status ? (
            <span className="weapon__warn">{status}</span>
          ) : (
            <span className="weapon__stats">
              <span className="weapon__stat">
                DMG <b>{weapon.dmg}</b>
              </span>
              {full.id === 'water' ? (
                <span className="weapon__stat weapon__ammo">
                  <DropGlyph />
                  {reloading ? <b className="weapon__reload">RELOAD</b> : <b>{full.ammo}</b>}
                </span>
              ) : (
                <span className="weapon__stat">
                  AMMO <b>—</b>
                </span>
              )}
            </span>
          )}
          {full.id === 'water' && (
            <span className="weapon__tank">
              <span style={{ width: `${reloading ? 0 : (full.ammo / mag) * 100}%` }} />
            </span>
          )}
        </span>
        <span className="weapon__pips" aria-hidden>
          {WEAPONS.map((w) => (
            <i key={w.id} className={w.id === full.id ? 'is-on' : ''} />
          ))}
        </span>
        {note && (
          <span className="weapon__note" aria-live="polite">
            {note}
          </span>
        )}
      </button>
      {crt && createPortal(<WeaponFxLayer ref={fx} />, crt)}
      {launched && <NukeBlast reduced={reduced} crt={crt} onReboot={() => setStored(DEFAULT_WEAPON)} />}
    </>
  )
}
