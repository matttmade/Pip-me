import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/share-tech-mono'
import '@fontsource/vt323'
import '@fontsource/alfa-slab-one'
import './index.css'
import App from './App.tsx'
import { startPerkTracking } from './features/perks/perks'
import { startSfx } from './features/sound/sfx'

startSfx()
startPerkTracking()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
