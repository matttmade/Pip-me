# Pip-Boy Personal Terminal — rules for Claude

## What this is
An unofficial, non-commercial Fallout fan case study: a browser recreation of
the Fallout 4 Pip-Boy 3000 Mk IV screen UI as a personal dashboard. Static site
on Vercel. It MUST read instantly as a Pip-Boy.

Specs: `pipboy-plan.md` (product spec) and `BUILD-PLAN.md` (execution plan,
contracts, ownership).

## Core experiences
- Animated UI: scanlines, subtle glitches, background noise, all driven by one
  EffectsConfig and controlled in DATA > SYSTEM.
- STAT: a three.js Vault Dweller in a looping walk; an uploaded headshot replaces
  the head via a billboard on the Head bone. Monochrome Pip shader on everything.
- MAP: real MapLibre map centered on the user's geolocation, Pip-Boy styled.
- Works with zero setup; customizations persist via src/lib/store.ts
  (sessionStorage today).
- Device: src/device/ shows the flat UI on a curved CRT (CrtGlass, SVG barrel
  warp) in two views: SCREEN (CRT fills the window, glowing rim) and ARM (the
  user-supplied photo composite in public/scene/, parallaxed, live screen pinned on
  the glass). A liquid-glass Dock holds view/sound/color/signal/degauss/fullscreen.
  Phones always get SCREEN and no dock. Art direction: ART-DIRECTION.md.

## Recreate faithfully
Pip-Boy layout (STAT INV DATA MAP RADIO, sub-tabs, bottom status bar, inverted
selected rows, glow), and Fallout terminology. Match /reference screenshots for
layout and spacing. Never import or ship files from /reference.

## Never
- Ship assets extracted from Fallout game files or copy in-game text verbatim.
- Draw Vault Boy. The figure is procedural or the openly licensed model in public/models.
- Add a backend, API keys, ads or payments.
- Upload headshots anywhere; process them in canvas only.
- Read/write sessionStorage or localStorage outside src/lib/store.ts.
- Change signatures in src/lib/contracts.ts from a feature branch. Feature
  branches consume the shared contracts and only touch their own folders.

## Always
- Disclaimer visible in the ON ARM view and in DATA > SYSTEM > ABOUT / LEGAL.
- Colors only from tokens.css / the hue in EffectsConfig.
- Respect prefers-reduced-motion and the SYSTEM settings.
- Pause animation loops (three.js, noise, radio) when hidden.
- Lazy-load three and maplibre.
- Mobile first: 100dvh, safe-area insets, touch targets >= 44px.
- Pure logic in .ts files with Vitest tests (`*.test.ts` next to the module).
- Before calling a task done: npm run check (lint && test && build).
