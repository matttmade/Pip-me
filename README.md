# Pip-Me Personal Terminal (Fan Project)

A browser recreation of a Fallout 4-style Pip-Boy screen as a personal dashboard, shown on a
curved CRT, either full screen or worn on an arm (switch with the dock or `V`).
A Vault Dweller walks on the STAT screen (drop in a headshot to become them), a real map
centers on your location, and the whole UI runs on scanlines, glitches and background
noise that you can tune in **DATA > SYSTEM**.

> **Unofficial fan-made case study.** Not affiliated with or endorsed by Bethesda Softworks,
> ZeniMax or Microsoft. Fallout, Pip-Boy and Vault-Tec are trademarks of their respective
> owners. Non-commercial: no ads, no accounts, no backend, no API keys.

## Privacy

- **Headshots** are cropped and processed in a `<canvas>` in your browser, and are never uploaded.
- **Location** goes only to the map tile provider (as tile requests), Open-Meteo (weather
  and city search) and Nominatim (place names), as coordinates.
- **Customizations** live in `sessionStorage` (see `src/lib/store.ts`) and disappear when
  the browser session ends. DATA > SYSTEM > RESET TERMINAL clears them right away.

## Assets and licenses

- No files extracted from Fallout games: no models, Vault Boy art, logos, textures, fonts, music or SFX.
  All copy is original.
- Vault Dweller: built procedurally from three.js primitives. If `public/models/dweller.glb` is
  present it's used instead. Note its source and license here when you add one.
- Fonts: Share Tech Mono, VT323 and Alfa Slab One (SIL Open Font License) via Fontsource.
- The Pip-Me wordmark is original CSS/SVG work, not Fallout logo art.
- The ON ARM scene (public/scene/: background, arm, Pip-Boy replica photo) was supplied by the
  project owner for this non-commercial case study.
- Map data © OpenStreetMap contributors; tiles by OpenFreeMap; weather by Open-Meteo.
- Sounds are synthesized live with Web Audio.
- APPALACHIA RADIO streams "Fallout 76 - Appalachia Radio" (uploaded by user-94305073) from SoundCloud
  through SoundCloud's official embedded player: https://soundcloud.com/user-94305073/fallout-76-appalachia-radio.
  No audio is downloaded or hosted by this project; all rights belong to their owners.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # lint + unit tests + type-check + build
node scripts/shots.mjs http://localhost:4173 shots   # screenshots (after `npx vite preview`)
```

Stack: Vite, React, TypeScript, plain CSS variables, three.js, MapLibre GL (Leaflet as a fallback), Vitest.
Deployed as a static site on Vercel. Geolocation needs HTTPS, so test the map on phones
using the Vercel preview URL.

Docs for contributors (and Claude): `CLAUDE.md`, `BUILD-PLAN.md`, `pipboy-plan.md`.
