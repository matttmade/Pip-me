import { Offline } from '../../shell/Offline'
import type { OverlayProps } from '../../lib/contracts'

/** STUB overlay: replaced by feat/dweller (P2). payload = the chosen File. */
export default function HeadshotCropper({ onClose }: OverlayProps) {
  return (
    <div className="overlay-stub">
      <Offline name="HEADSHOT CALIBRATION" />
      <button className="pip-btn" onClick={onClose}>[ CANCEL ]</button>
    </div>
  )
}
