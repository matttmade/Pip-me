import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { triggerGlitch } from '../../lib/contracts'
import { BLAST_GLITCHES, blastTimeline, type BlastPhase } from './weapons'
import { weaponSfx } from './weaponSfx'

const GLYPHS = '▓▒░█#%&@$*!?/\\<>=+'

/** Heavy shake keyframes: big random jolts that decay to rest. */
function quakeFrames(): Keyframe[] {
  const n = 22
  return Array.from({ length: n + 1 }, (_, i) => {
    const k = i === n ? 0 : 18 * (1 - i / n) ** 1.4
    const x = (Math.random() * 2 - 1) * k
    const y = (Math.random() * 2 - 1) * k
    return { transform: `translate(${x}px, ${y}px) rotate(${(Math.random() * 2 - 1) * k * 0.05}deg)` }
  })
}

/** Text in the screen dissolves into block glyphs, a little more every tick. */
function scramble(root: Element | null, ms: number): () => void {
  if (!root) return () => {}
  const nodes: Text[] = []
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walk.nextNode() && nodes.length < 600) {
    const n = walk.currentNode as Text
    if (n.nodeValue && n.nodeValue.trim()) nodes.push(n)
  }
  const t0 = performance.now()
  const id = window.setInterval(() => {
    const p = Math.min(1, (performance.now() - t0) / ms)
    for (const n of nodes) {
      const v = n.nodeValue ?? ''
      let out = ''
      for (const ch of v) out += ch !== ' ' && Math.random() < p * 0.6 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : ch
      n.nodeValue = out
    }
  }, 70)
  return () => window.clearInterval(id)
}

/** Static: a small noise field, re-rolled every frame and scaled up (pixelated) by CSS. */
function startNoise(c: HTMLCanvasElement): () => void {
  const g = c.getContext('2d')
  if (!g) return () => {}
  const w = (c.width = 200)
  const h = (c.height = 120)
  const img = g.createImageData(w, h)
  const pip = getComputedStyle(c).getPropertyValue('--pip-hi').trim() || 'white'
  let raf = 0
  const tick = () => {
    // random alpha speckle, then tinted phosphor with source-in
    const d = img.data
    for (let i = 3; i < d.length; i += 4) d[i] = Math.random() < 0.45 ? 40 + Math.random() * 215 : 0
    g.globalCompositeOperation = 'source-over'
    g.putImageData(img, 0, 0)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = pip
    g.fillRect(0, 0, w, h)
    raf = requestAnimationFrame(tick)
  }
  tick()
  return () => cancelAnimationFrame(raf)
}

/**
 * The NUKE going off: white-out flash, a mushroom cloud rising off the screen, a
 * shockwave, heavy shake and glitching, the UI melting into static, the tube collapsing,
 * then SIGNAL LOST · REBOOTING and a real page reload (the boot loader replays its short
 * version). Reduced motion: a plain fade to the reboot notice.
 */
export default function NukeBlast({ reduced, crt, onReboot }: { reduced: boolean; crt: HTMLElement | null; onReboot: () => void }) {
  const [phase, setPhase] = useState<BlastPhase>(() => blastTimeline(reduced)[0].phase)
  const noise = useRef<HTMLCanvasElement>(null)
  const rebootRef = useRef(onReboot)
  useLayoutEffect(() => {
    rebootRef.current = onReboot
  })
  // The blast plays on the screen: the overlay's screen box sits exactly over the CRT
  // (the whole window in SCREEN view, the glass in the ON ARM view). Only the flash and
  // the shake reach past it.
  const [box] = useState(() => {
    const r = crt?.getBoundingClientRect()
    const width = r?.width ?? window.innerWidth
    const height = r?.height ?? window.innerHeight
    const radius = crt ? getComputedStyle(crt).borderRadius : '0px'
    return { left: r?.left ?? 0, top: r?.top ?? 0, width, height, radius }
  })
  const screen = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (reduced || !noise.current) return
    return startNoise(noise.current)
  }, [reduced])

  useEffect(() => {
    const timers: number[] = []
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const cleanups: (() => void)[] = []
    const tube = (crt?.querySelector('.crt__tube') as HTMLElement | null) ?? crt
    const stage = (document.querySelector('.stage') as HTMLElement | null) ?? document.getElementById('root')

    weaponSfx.boom()
    // Nothing else happens until the reboot: swallow keys so a tab switch can't unmount the blast.
    const swallow = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', swallow, true)
    cleanups.push(() => window.removeEventListener('keydown', swallow, true))
    for (const cue of blastTimeline(reduced)) {
      later(cue.at, () => {
        setPhase(cue.phase)
        if (cue.phase === 'melt' && tube) {
          cleanups.push(scramble(tube, 800))
          tube.animate(
            [
              { transform: 'none', filter: 'none' },
              { transform: 'skewX(-3deg) scale(1.02, 1.05) translateY(1%)', filter: 'blur(1px) brightness(1.5) contrast(1.4)', offset: 0.35 },
              { transform: 'skewX(6deg) scale(.98, 1.35) translateY(12%)', filter: 'blur(5px) brightness(.7) contrast(2.2)' },
            ],
            { duration: 820, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' },
          )
        }
        if (cue.phase === 'lost') {
          weaponSfx.powerDown()
          // the classic tube switch-off: squash to a line, then to a dot
          if (!reduced && crt)
            crt.animate(
              [
                { transform: 'none', filter: 'brightness(1)' },
                { transform: 'scale(1, .006)', filter: 'brightness(4)', offset: 0.55 },
                { transform: 'scale(0, .006)', filter: 'brightness(6)' },
              ],
              { duration: 380, easing: 'ease-in', fill: 'forwards' },
            )
        }
        if (cue.phase === 'reboot') {
          rebootRef.current()
          window.location.reload()
        }
      })
    }
    if (!reduced) {
      const frames = quakeFrames()
      for (const el of [stage, screen.current]) el?.animate?.(frames, { duration: 1700, easing: 'linear' })
      for (const at of BLAST_GLITCHES) later(at, () => triggerGlitch(1, { force: true }))
    }
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      cleanups.forEach((fn) => fn())
    }
  }, [crt, reduced])

  const place = {
    left: box.left,
    top: box.top,
    width: box.width,
    height: box.height,
    borderRadius: box.radius,
    '--nh': `${Math.min(box.height * 0.92, box.width * 1.05)}px`,
  } as CSSProperties

  return createPortal(
    <div className={`nuke${reduced ? ' nuke--reduced' : ''}`} data-phase={phase} role="alert" aria-live="assertive">
      <div ref={screen} className="nuke__screen" style={place}>
        <div className="nuke__dim" />
        <canvas ref={noise} className="nuke__noise" aria-hidden />
        {!reduced && (
          <>
            <div className="nuke__ring" aria-hidden />
            <svg className="nuke__cloud" viewBox="0 0 200 240" aria-hidden focusable="false">
              <defs>
                <pattern id="nuke-band" width="4" height="4" patternUnits="userSpaceOnUse">
                  <rect width="4" height="2" className="nuke__band" />
                </pattern>
              </defs>
              <g className="nuke__base">
                {[
                  [100, 232, 22],
                  [72, 230, 17],
                  [128, 230, 17],
                  [48, 234, 12],
                  [152, 234, 12],
                  [28, 237, 8],
                  [172, 237, 8],
                ].map(([cx, cy, r], i) => (
                  <circle key={i} className="nuke__puff" cx={cx} cy={cy} r={r} style={{ animationDelay: `${i * 90}ms` }} />
                ))}
              </g>
              <g className="nuke__stem">
                <path className="nuke__body" d="M80 238C89 205 92 160 89 108h22c-3 52 0 97 9 130z" />
                <path className="nuke__swirl" d="M95 230c4-30 2-62 4-112 M106 232c-3-40 0-80-1-118" />
              </g>
              <ellipse className="nuke__collar" cx="100" cy="150" rx="34" ry="6" />
              <g className="nuke__cap">
                <ellipse className="nuke__body" cx="100" cy="98" rx="58" ry="14" />
                {[
                  [52, 86, 18],
                  [148, 86, 18],
                  [74, 72, 25],
                  [126, 72, 25],
                  [86, 50, 21],
                  [116, 48, 22],
                  [100, 66, 30],
                  [100, 92, 20],
                ].map(([cx, cy, r], i) => (
                  <circle key={i} className="nuke__puff" cx={cx} cy={cy} r={r} style={{ animationDelay: `${i * 70}ms` }} />
                ))}
                <circle className="nuke__core" cx="100" cy="74" r="26" />
                <path className="nuke__swirl" d="M58 98c14-8 30-10 42-6s28 4 42-4 M70 64c10-10 22-12 30-6 M108 44c8-4 16-2 22 6" />
              </g>
            </svg>
          </>
        )}
        <div className="nuke__lost">
          <span className="nuke__lost-title">SIGNAL LOST</span>
          <span className="nuke__lost-sub">
            REBOOTING…<span className="cursor">▌</span>
          </span>
        </div>
      </div>
      {!reduced && <div className="nuke__flash" aria-hidden />}
    </div>,
    document.body,
  )
}
