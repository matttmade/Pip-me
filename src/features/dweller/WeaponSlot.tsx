import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { mulberry32, useOverlay, usePrefersReducedMotion, useStored, type Rng } from '../../lib/contracts'
import { requestEmote } from './emotes'
import { figureFacing, onFigureTap } from './figureTap'
import { squirtAim } from './vaultboy/spin'
import { DropGlyph, WeaponGlyph } from './glyphs'
import NukeBlast from './NukeBlast'
import { WeaponFxLayer, type WeaponFxHandle } from './WeaponFxLayer'
import {
  confirmLeft,
  cycleWeapon,
  DEFAULT_WEAPON,
  equipWeapon,
  isReloading,
  normalizeWeapon,
  pressNuke,
  settle,
  squirt,
  WEAPON_KEY,
  weaponById,
  WEAPONS,
  type WeaponId,
  type WeaponState,
} from './weapons'
import { Flyout, type FlyoutItem } from './Flyout'
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
 * STATUS WEAPON fly-out: a round trigger in the stage's bottom-left corner showing what's
 * equipped; tap it to pick FIST / WATER PISTOL / MINI NUKE. W still swaps through all three.
 * The equipped weapon decides what a tap on the figure does: FIST punches the glass, WATER
 * PISTOL squirts it, and the NUKE needs two taps (figure, or the trigger once it's asking)
 * within three seconds to launch (the app blows up and reboots).
 */
export function WeaponSlot({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
  const box = useRef<HTMLSpanElement>(null)
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

  /** A pick from the fly-out. */
  const equip = (id: WeaponId) => {
    if (launched || id === full.id) return
    commit(equipWeapon(full, id))
    weaponSfx.swap()
    setKick((k) => k + 1)
    if (id !== 'fist') weaponSfx.arm()
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
      // a keyboard punch lands on the side he's turned to
      const f = figureFacing()
      const p = at ?? (c && { x: c.from.x + (f == null ? 0 : Math.sin(f) * c.w * 0.25), y: c.from.y })
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
        // turned by a drag: the shot follows his facing (sideways, or away into the screen)
        const f = figureFacing()
        const aim = f == null ? null : squirtAim(f)
        if (aim && (Math.abs(aim.x) > 0.35 || aim.z < 0)) {
          const dir: 1 | -1 = Math.abs(aim.x) > 0.05 ? (aim.x < 0 ? -1 : 1) : (side.current = side.current === 1 ? -1 : 1)
          fx.current?.squirt({ x: c.from.x + aim.x * c.w * 0.22, y: c.from.y }, dir, rng.current, reduced, aim)
        } else {
          const dir: 1 | -1 = c.pointsLeft ? -1 : at ? (at.x < c.mid ? -1 : 1) : (side.current = side.current === 1 ? -1 : 1)
          fx.current?.squirt({ x: c.from.x + dir * c.w * (c.pointsLeft ? 0.22 : 0.08), y: c.from.y }, dir, rng.current, reduced)
        }
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
  const ammo = reloading ? 'R' : String(full.ammo)
  const label = launched
    ? 'Weapon: mini nuke, launched.'
    : armed
      ? `Mini nuke armed. Tap again to launch, ${left} seconds left.`
      : `Weapon: ${weapon.name.toLowerCase()}${full.id === 'water' ? `, ${reloading ? 'reloading' : `${full.ammo} of ${mag} water`}` : ''}. Open the weapon menu.`

  const items: FlyoutItem[] = WEAPONS.map((w) => ({
    key: w.id,
    icon: <WeaponGlyph id={w.id} />,
    label: w.name,
    meta:
      w.id === 'water' ? (
        <span className="flyout__ammo">
          <DropGlyph />
          {reloading ? <b className="weapon__reload">RELOAD</b> : <b>{full.ammo}</b>}
        </span>
      ) : w.id === 'nuke' ? (
        '2-TAP'
      ) : (
        `DMG ${w.dmg}`
      ),
    ariaLabel:
      w.id === 'water'
        ? `Water pistol, ${reloading ? 'reloading' : `${full.ammo} of ${mag} water`}`
        : w.id === 'nuke'
          ? 'Mini nuke. Once equipped, tap the figure twice within 3 seconds to launch.'
          : `Fist, damage ${w.dmg}`,
    checked: w.id === full.id,
    className: `weapon-item--${w.id}`,
    onSelect: () => equip(w.id),
  }))

  return (
    <>
      <Flyout
        id="weapon"
        side="left"
        className={`weapon--${full.id}${armed ? ' is-armed' : ''}${reloading ? ' is-reloading' : ''}${launched ? ' is-launched' : ''}`}
        open={open && !armed && !launched}
        onOpenChange={(o) => (armed ? nuke(full) : onOpenChange(o))}
        triggerLabel={label}
        triggerTitle={armed ? 'Tap again to launch' : 'Weapon  [W: swap]'}
        trigger={
          <>
            <span key={`${full.id}-${kick}`} className="weapon__icon">
              <WeaponGlyph id={full.id} />
            </span>
            {full.id === 'water' && (
              <span className="weapon__pip">
                <DropGlyph />
                {ammo}
              </span>
            )}
          </>
        }
        caption={armed ? `LAUNCH ${left}` : weapon.id === 'water' ? 'WATER' : weapon.id === 'nuke' ? 'NUKE' : 'FIST'}
        menuLabel="Weapon"
        items={items}
      >
        <span ref={box} className="weapon__notes" aria-live="polite">
          {armed ? (
            <span className="weapon__banner">TAP AGAIN TO LAUNCH · {left}</span>
          ) : note ? (
            <span className="weapon__note">{note}</span>
          ) : null}
        </span>
      </Flyout>
      {crt && createPortal(<WeaponFxLayer ref={fx} />, crt)}
      {launched && <NukeBlast reduced={reduced} crt={crt} onReboot={() => setStored(DEFAULT_WEAPON)} />}
    </>
  )
}
