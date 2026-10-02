/** HP in the status bar. level is 0-1. STUB, owned by feat/map (P3). */
export function useBattery(): { level: number; charging: boolean } {
  return { level: 1, charging: false }
}
