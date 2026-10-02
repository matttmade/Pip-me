import { Offline } from '../../shell/Offline'
import type { OverlayProps } from '../../lib/contracts'

/** STUB overlay: replaced by feat/terminal-radio (P5). */
export default function Terminal({ onClose }: OverlayProps) {
  return (
    <div className="overlay-stub">
      <Offline name="ROBCO TERMINAL" />
      <button className="pip-btn" onClick={onClose}>[ EXIT ]</button>
    </div>
  )
}
