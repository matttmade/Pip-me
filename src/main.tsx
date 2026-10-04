import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/share-tech-mono'
import '@fontsource/vt323'
import '@fontsource/alfa-slab-one'
import './index.css'
import App from './App.tsx'
import { startPerkTracking } from './features/perks/perks'
import { startSfx } from './features/sound/sfx'
import { captureInstallEvents } from './features/install/installStore'
import { bootApp } from './loader/handoff'
import { Mounted } from './loader/Mounted'

startSfx()
startPerkTracking()
captureInstallEvents()

// It's an app, not a document: no ghost-dragging images/text out of the UI.
document.addEventListener('dragstart', (e) => {
  if (!(e.target instanceof HTMLElement && e.target.closest('input, textarea, [draggable="true"]'))) e.preventDefault()
})

// Warm the STAT figure (three.js + Vault Boy scene chunk) while the boot screen plays;
// the model file itself is preloaded from index.html. StatusPanel's lazy import reuses this.
const warm = () => void import('./features/dweller/VaultBoyScene').catch(() => {})
if ('requestIdleCallback' in window) window.requestIdleCallback(warm, { timeout: 800 })
else setTimeout(warm, 300)

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
