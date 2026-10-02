import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/share-tech-mono'
import '@fontsource/vt323'
import './index.css'
import App from './App.tsx'
import { startSfx } from './features/sound/sfx'

startSfx()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
