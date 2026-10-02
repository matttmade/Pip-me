import { useEffect, useState } from 'react'

type OrientationEvt = DeviceOrientationEvent & { webkitCompassHeading?: number }
type OrientationCtor = { requestPermission?: () => Promise<'granted' | 'denied'> }

/** Compass heading (0 = north, clockwise) from a deviceorientation event, or null. */
export function headingFromOrientation(e: { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number }): number | null {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) return e.webkitCompassHeading
  if (e.absolute && e.alpha != null) return (360 - e.alpha) % 360
  return null
}

/** iOS needs DeviceOrientationEvent.requestPermission() from a user gesture. Call it on a tap. */
export async function requestOrientationPermission(): Promise<void> {
  const ctor = (typeof window !== 'undefined' ? window.DeviceOrientationEvent : undefined) as unknown as OrientationCtor | undefined
  if (ctor?.requestPermission) {
    try {
      await ctor.requestPermission()
    } catch {
      // denied or not from a gesture: GPS heading still works while moving
    }
  }
}

/** GPS heading when moving, else the device compass, else null. */
export function useHeading(gpsHeading: number | null, enabled: boolean): number | null {
  const [compass, setCompass] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
    let last = 0
    const onEvt = (e: Event) => {
      const h = headingFromOrientation(e as OrientationEvt)
      const now = performance.now()
      if (h == null || now - last < 100) return
      last = now
      setCompass(Math.round(h))
    }
    const type = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'
    window.addEventListener(type, onEvt)
    return () => window.removeEventListener(type, onEvt)
  }, [enabled])
  return gpsHeading ?? compass
}
