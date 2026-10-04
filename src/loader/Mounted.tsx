import { useEffect, type ReactNode } from 'react'

/** Calls `onMounted` once its subtree has committed (parent effects run after children's). */
export function Mounted({ onMounted, children }: { onMounted: () => void; children: ReactNode }) {
  useEffect(onMounted, [onMounted])
  return children
}
