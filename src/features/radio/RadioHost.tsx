import { useEffect } from 'react'
import { pipRgb, useEffectsConfig, usePageVisible, useSettings } from '../../lib/contracts'
import { radio, useRadio, type ScControls } from './engine'
import { APPALACHIA_ID, APPALACHIA_STATION, buildWidgetUrl, rgbToHex } from './soundcloud'
import { SoundCloudPlayer } from './SoundCloudPlayer'

/** Callback ref: hands the widget's transport to the engine (null on unmount). */
const registerSc = (c: ScControls | null) => radio.registerSc(c)

/**
 * Always mounted (outside the tab panel) so the radio keeps playing on every tab.
 * Wires the engine to SYSTEM settings and page visibility, and holds the hidden
 * SoundCloud widget while APPALACHIA RADIO is tuned. Renders nothing visible.
 */
export function RadioHost() {
  const { station, sc } = useRadio()
  const [settings] = useSettings()
  const [cfg] = useEffectsConfig()
  const visible = usePageVisible()

  useEffect(() => radio.attach(), [])

  if (station !== APPALACHIA_ID) return null
  return (
    <SoundCloudPlayer
      key={sc.attempt}
      ref={registerSc}
      src={buildWidgetUrl(APPALACHIA_STATION.trackUrl, { color: rgbToHex(pipRgb(cfg.hue)), autoPlay: false })}
      title={`SoundCloud player: ${APPALACHIA_STATION.name}`}
      volume={sc.muted ? 0 : settings.volume}
      visible={visible}
      startAt={radio.scStartAt}
      onStatus={radio.onScStatus}
      onProgress={radio.onScProgress}
      onSound={radio.onScSound}
    />
  )
}
