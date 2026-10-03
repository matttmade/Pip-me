import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/share-tech-mono'
import '@fontsource/vt323'
import '@fontsource/alfa-slab-one'
import './index.css'
import App from './App.tsx'
import { startPerkTracking } from './features/perks/perks'
import { startSfx } from './features/sound/sfx'
import { bootApp } from './loader/handoff'
import { Mounted } from './loader/Mounted'

startSfx()
startPerkTracking()

// The inline boot loader (index.html) is the only boot: React mounts underneath it right away
// and tells it when the first frame is in, then the loader wipes away to reveal the app.
bootApp((mounted) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Mounted onMounted={mounted}>
        <App />
      </Mounted>
    </StrictMode>,
  ),
)
