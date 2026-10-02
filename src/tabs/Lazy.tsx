import { Suspense, type ReactNode } from 'react'

export function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p className="loading">LOADING<span className="cursor">▌</span></p>}>{children}</Suspense>
}
