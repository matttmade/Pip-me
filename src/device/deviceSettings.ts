import { useStored } from '../lib/store'

export type View = 'screen' | 'arm'

export type DeviceSettings = {
  /** Real barrel warp of the screen. null = auto (on for desktop Chromium/Firefox). */
  warp: boolean | null
  /** PC-style phosphor cursor on the screen (desktop pointers only). */
  cursor?: boolean
}

export const DEFAULT_DEVICE: DeviceSettings = { warp: null }
export const useDeviceSettings = () => useStored<DeviceSettings>('device', DEFAULT_DEVICE)
/** Desktop view: just the screen, or the Pip-Boy on an arm. Phones always get the screen. */
export const useView = () => useStored<View>('device:view', 'arm')

export function warpAutoDefault(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const safari = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(ua)
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  return !safari && !coarse
}
