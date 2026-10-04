import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { emit } from '../lib/events'
import { usePageVisible } from '../lib/hooks'
import { useEffectsConfig } from './EffectsProvider'
import { makeGlitch, nextDelay, onGlitchRequest, triggerGlitch, type Glitch } from './glitchScheduler'
import { PIP_SAT } from './color'

/**
 * Horizontal slice tearing via an SVG displacement filter whose map only varies along y,
 * plus an optional hue-shifted RGB split and a small vertical jump of the whole screen.
 * Styles are written straight to the DOM so a glitch never re-renders React content.
 */
export function GlitchLayer({
  content,
  screen,
}: {
  content: RefObject<HTMLElement | null>
  screen: RefObject<HTMLElement | null>
}) {
  const [cfg] = useEffectsConfig()
  const visible = usePageVisible()
  const turb = useRef<SVGFETurbulenceElement>(null)
  const func = useRef<SVGFEFuncRElement>(null)
  const disp = useRef<SVGFEDisplacementMapElement>(null)
  const cfgRef = useRef(cfg)
  useLayoutEffect(() => {
    cfgRef.current = cfg
  }, [cfg])

  useEffect(() => {
    let endTimer: number | undefined
    const run = (g: Glitch) => {
      const el = content.current
      const scr = screen.current
      if (!el || !scr) return
      turb.current?.setAttribute('seed', String(g.seed))
      func.current?.setAttribute('tableValues', g.bands.join(' '))
      disp.current?.setAttribute('scale', String(g.scale))
      const hue = cfgRef.current.hue
      const split = g.rgb
        ? ` drop-shadow(${g.rgb}px 0 0 hsl(${hue + 60} ${PIP_SAT * 100}% 60% / .55)) drop-shadow(${-g.rgb}px 0 0 hsl(${hue - 60} ${PIP_SAT * 100}% 60% / .55))`
        : ''
      el.style.filter = `url(#pip-glitch)${split}`
      scr.style.transform = g.dy ? `translateY(${g.dy}px)` : ''
      window.clearTimeout(endTimer)
      endTimer = window.setTimeout(() => {
        el.style.filter = ''
        scr.style.transform = ''
      }, g.duration)
      emit({ type: 'glitch', strength: g.scale })
    }
    const off = onGlitchRequest(({ strength, force }) => {
      const c = cfgRef.current.glitch
      if (force || c.on) run(makeGlitch(strength, c.rgbSplit, Math.random))
    })
    return () => {
      off()
      window.clearTimeout(endTimer)
    }
  }, [content, screen])

  const { on, frequency, strength, rgbSplit } = cfg.glitch
  useEffect(() => {
    if (!visible || !on) return
    let timer: number
    const schedule = () => {
      const delay = nextDelay({ on, frequency, strength, rgbSplit }, Math.random)
      if (!Number.isFinite(delay)) return
      timer = window.setTimeout(() => {
        triggerGlitch(strength)
        schedule()
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [visible, on, frequency, strength, rgbSplit])

  return (
    <svg className="fx-defs" width="0" height="0" aria-hidden focusable="false">
      <filter id="pip-glitch" x="-5%" y="0" width="110%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence ref={turb} type="fractalNoise" baseFrequency="0 0.035" numOctaves={1} seed={1} result="t" />
        <feComponentTransfer in="t" result="bands">
          <feFuncR ref={func} type="discrete" tableValues="0.5" />
        </feComponentTransfer>
        <feColorMatrix
          in="bands"
          type="matrix"
          values="1 0 0 0 0  0 0 0 0 0.5  0 0 0 0 0  0 0 0 0 1"
          result="map"
        />
        <feDisplacementMap ref={disp} in="SourceGraphic" in2="map" scale={20} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
