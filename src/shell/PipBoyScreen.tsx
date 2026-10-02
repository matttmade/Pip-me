import { useRef, type ReactNode } from 'react'
import { GlitchLayer } from '../effects/GlitchLayer'
import { NoiseLayer } from '../effects/NoiseLayer'

/** The phosphor surface: every effect layer around the live content. DeviceStage frames it. */
export function PipBoyScreen({ children }: { children: ReactNode }) {
  const screen = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  return (
    <div className="pip-screen" ref={screen}>
      <NoiseLayer placement="back" />
      <div className="pip-content" ref={content}>
        {children}
      </div>
      <div className="fx-scanlines" aria-hidden />
      <NoiseLayer placement="front" />
      <div className="fx-roll" aria-hidden />
      <div className="fx-vignette" aria-hidden />
      <GlitchLayer content={content} screen={screen} />
    </div>
  )
}
