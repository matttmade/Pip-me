import { useStored } from '../lib/store'

export type Finish = 'OLIVE' | 'GUNMETAL' | 'RUST' | 'KHAKI'
export const FINISHES: Finish[] = ['OLIVE', 'GUNMETAL', 'RUST', 'KHAKI']

export type DeviceSettings = {
  finish: Finish
  /** Real barrel warp of the screen. null = auto (on for desktop Chromium/Firefox). */
  warp: boolean | null
  /** PC-style phosphor cursor on the screen (desktop pointers only). */
  cursor?: boolean
}

export const DEFAULT_DEVICE: DeviceSettings = { finish: 'OLIVE', warp: null }
export const useDeviceSettings = () => useStored<DeviceSettings>('device', DEFAULT_DEVICE)
export const useZoom = () => useStored<'in' | 'out'>('device:zoom', 'in')

export function warpAutoDefault(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const safari = /^((?!chrome|chromium|android|crios|fxios).)*safari/i.test(ua)
  const coarse = window.matchMedia?.('(pointer: coarse)').matches
  return !safari && !coarse
}
