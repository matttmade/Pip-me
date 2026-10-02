import { useStored } from './store'

export type Profile = { name: string; vault: string }
export type Settings = {
  units: 'F' | 'C'
  wastelandDate: boolean
  sound: boolean
  volume: number // 0-1
}

export const DEFAULT_PROFILE: Profile = { name: 'VAULT DWELLER', vault: '111' }
export const DEFAULT_SETTINGS: Settings = { units: 'F', wastelandDate: true, sound: true, volume: 0.5 }

export const useProfile = () => useStored<Profile>('profile', DEFAULT_PROFILE)
export const useSettings = () => useStored<Settings>('settings', DEFAULT_SETTINGS)
