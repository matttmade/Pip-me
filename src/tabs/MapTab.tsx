import { lazy } from 'react'
import { Lazy } from './Lazy'

// MapPanel pulls in maplibre-gl, so it loads only when MAP opens.
const MapPanel = lazy(() => import('../features/map/MapPanel'))

export function MapTab() {
  return (
    <Lazy>
      <MapPanel />
    </Lazy>
  )
}
