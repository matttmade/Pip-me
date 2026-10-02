import { lazy } from 'react'
import { Lazy } from './Lazy'

const RadioPanel = lazy(() => import('../features/radio/RadioPanel'))

export function RadioTab() {
  return (
    <Lazy>
      <RadioPanel />
    </Lazy>
  )
}
