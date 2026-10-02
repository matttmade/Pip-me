import { useEffect, useState } from 'react'
import { useProfile } from '../lib/profile'

// Original boot copy written for this project (not game text).
const lines = (name: string, vault: string) => [
  'VAULT-TEC WRIST TERMINAL  //  FIRMWARE 3.0.MK4',
  '(C) VAULT-TEC PERSONAL SYSTEMS DIVISION',
  '',
  'PHOSPHOR CALIBRATION ........ OK',
  'CORE MEMORY 64K ............. OK',
  'GEIGER SENSOR ............... ONLINE',
  'HOLOTAPE DECK ............... READY',
  'SATELLITE UPLINK ............ STANDBY',
  '',
  `LOADING DWELLER PROFILE: ${name.toUpperCase()} // VAULT ${vault}`,
  'WELCOME BACK. REMEMBER: VAULT-TEC CARES.',
]

const STEP = 230

export function BootSequence({ onDone }: { onDone: () => void }) {
  const [profile] = useProfile()
  const all = lines(profile.name, profile.vault)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (count >= all.length) {
      const t = window.setTimeout(onDone, 700)
      return () => window.clearTimeout(t)
    }
    const t = window.setTimeout(() => setCount((c) => c + 1), STEP)
    return () => window.clearTimeout(t)
  }, [count, all.length, onDone])

  useEffect(() => {
    const skip = () => onDone()
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [onDone])

  return (
    <div className="boot" onClick={onDone} role="status" aria-label="Booting. Press any key to skip.">
      <pre className="boot__text">
        {all.slice(0, count).join('\n')}
        <span className="cursor">▌</span>
      </pre>
      <p className="boot__skip">PRESS ANY KEY OR TAP TO SKIP</p>
    </div>
  )
}
