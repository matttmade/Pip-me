import { useEffect, useRef, useState } from 'react'

export const fmtDate = (ms?: number) => {
  if (!ms) return 'UNKNOWN'
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

/** A status message that clears itself after `ms`. */
export function useNotice(ms = 3000): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = (m: string) => {
    clearTimeout(timer.current)
    setMsg(m)
    timer.current = setTimeout(() => setMsg(null), ms)
  }
  return [msg, show]
}

export function openLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
