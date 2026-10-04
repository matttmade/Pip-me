# Pip-Boy Personal Terminal: Fallout Fan Case Study
### Build plan for Claude Code (AI Learning Day, Fri Oct 2 2026)

> Source product spec. For the execution plan, contracts and ownership adapted to
> this repo (`matttmade/Pip-me`), see `BUILD-PLAN.md`; where they differ, BUILD-PLAN wins.

**One-liner:** A browser recreation of the Fallout 4 Pip-Boy 3000 Mk IV as a personal dashboard. A 3D Vault Dweller walks in a loop on the STAT screen, and you can drop in a headshot to become them. A real map centers on your location. The whole UI is alive with scanlines, subtle glitches and background noise, all tunable from a SYSTEM tab.

**Hard requirements**
1. Reads instantly as a Fallout Pip-Boy
2. Real, in-browser map based on the user's location
3. Animated UI: scanlines, subtle glitch, background noise, controlled in a tab
4. 3D Vault Dweller in a looping walk; uploaded headshot replaces the head
5. Works out of the box; customizations stored for the browser session

**Project type:** Unofficial, non-commercial Fallout fan case study. Free, no ads, no accounts, no backend, no API keys.

---

## 1. Fan Project Rules

**Recreate (the point)**
- Pip-Boy 3000 Mk IV screen UI: top tabs, sub-tabs, bottom status bar, inverted selected rows, single-hue phosphor look
- Fallout terminology: Vault-Tec, Vault Dweller, S.P.E.C.I.A.L., holotapes, RobCo terminal, RADS, caps, perks
- Mechanics as homage: S.P.E.C.I.A.L., XP and level, terminal hacking, radio

**Build ourselves**
- No assets extracted from Fallout game files (models, Vault Boy art, logos, textures, fonts, music, SFX, voice)
- No verbatim in-game text; write original flavor copy in the same voice
- The 3D Vault Dweller is a free, openly licensed rigged character (or procedural), recolored to a vault jumpsuit and rendered in Pip-Boy green

**Hygiene**
- Non-commercial only
- Footer on every view: "Unofficial fan-made case study. Not affiliated with or endorsed by Bethesda Softworks, ZeniMax or Microsoft. Fallout, Pip-Boy and Vault-Tec are trademarks of their respective owners."
- Headshots processed in the browser, never uploaded
- Location is sent only to the map tile and weather providers (as coordinates/tile requests)

---

## 3. Stack

| Piece | Choice | Notes |
|---|---|---|
| Build | Vite + React + TypeScript | Static `dist/` |
| Styling | Plain CSS + CSS variables | Effects driven by variables |
| Fonts | `@fontsource/share-tech-mono`, `@fontsource/vt323` | |
| Effects | CSS (scanlines, vignette, glow, flicker, roll bar) + small canvas (noise) + JS scheduler (glitch) | One `EffectsConfig` drives all |
| 3D Dweller | `three` + `GLTFLoader` + `AnimationMixer` + custom post-process shader | Lazy-loaded |
| Map | `maplibre-gl` + OpenFreeMap vector tiles with a custom Pip-Boy style | Free, no key; verify current style URL at build time |
| Map fallback | Leaflet + OSM raster tiles + green CSS filter | If vector tiles fail |
| Place name | Nominatim reverse geocoding (cached, one call per location) | Respect its usage policy |
| Weather | Open-Meteo forecast + geocoding | Free, no key |
| Sound | Web Audio, synthesized | No game audio |
| State | `sessionStorage` via one typed store | Swappable to `localStorage` in one line |
| Tests | Vitest | Pure functions |
| Hosting | Vercel Hobby via GitHub | Preview URL per branch |

---

## 4. Out of the Box + Session Customization

**Zero-setup first load**
1. Boot sequence plays
2. STAT: default Vault Dweller walks with the default head
3. MAP: asks for location; if allowed, centers on the user. If denied or unavailable, opens on Boston ("THE COMMONWEALTH") with a city search
4. Effects run on the "CLASSIC" preset; reduced-motion users get "SUBTLE" automatically
5. Weather, clock and the Terminal game all work without any input

**Session-stored customizations** (DATA > SYSTEM)
- Display effects and preset
- Pip-Boy color preset / hue
- Headshot (stored as a 256px processed PNG data URL)
- Name and vault number
- Location override, units (F/C), Wasteland date toggle
- Sound on/off, volume
- Quests, holotapes, perks, hack streak
- "RESET TERMINAL" button clears the session

**Storage design:** one `store.ts` with a `persistence` constant (`'session' | 'local'`). Today it's `'session'`. Flipping it makes everything survive browser restarts.

---

## 5. Pip-Boy Information Architecture

| Tab | Sub-tab | Content |
|---|---|---|
| **STAT** | STATUS | 3D walking Vault Dweller (your headshot as the head), limb-condition bars, name, vault number |
| | SPECIAL | S.P.E.C.I.A.L. 1-10 seeded from your name, original descriptions |
| | PERKS | Achievements from app use |
| **INV** | HOLOTAPES | Bookmarks import; includes the "RobCo Terminal" holotape (hacking game) |
| | AID | Pinned quick links |
| **DATA** | QUESTS | To-dos with XP |
| | STATS | Clock, real date, Wasteland date (year + 261), weather, day-cycle bar |
| | SYSTEM | **Effects controls** and all customization |
| **MAP** | LOCAL | Real interactive map centered on you, Pip-Boy styled |
| **RADIO** | STATIONS | Synthesized stations + your own local audio file, oscilloscope |

**Bottom status bar (always visible)**
- **HP:** battery (100/100 if unsupported)
- **LEVEL + XP bar:** from quests
- **AP:** daylight remaining
- **Right:** time and caps (daily hack streak)

---

## 6. Effects Engine

All effects layer over the whole Pip-Boy screen and read from one config.

```ts
type EffectsConfig = {
  preset: 'OFF' | 'SUBTLE' | 'CLASSIC' | 'DAMAGED' | 'CUSTOM';
  scanlines:   { on: boolean; opacity: number; density: number; speed: number }; // density = px period
  noise:       { on: boolean; amount: number; fps: number };                    // grain strength 0-1
  glitch:      { on: boolean; frequency: number; strength: number; rgbSplit: boolean };
  flicker:     { on: boolean; amount: number };
  rollBar:     { on: boolean; interval: number };                                // seconds
  glow:        number;   // 0-1
  vignette:    number;   // 0-1
  curvature:   number;   // 0-1 (visual only: rounded corners + inset shadow)
  hue:         number;   // 0-360, presets: FO4 green 135, NV amber 38, blue 200
};
```

**How each layer works**
- **Scanlines:** `repeating-linear-gradient` on a fixed overlay; slow vertical drift via `background-position` animation
- **Noise:** 128×128 offscreen canvas regenerated at `noise.fps` (default 18), tiled with `image-rendering: pixelated` and `mix-blend-mode: screen` at low opacity. Sits *behind* content (background noise) plus a fainter copy on top
- **Glitch:** JS scheduler picks a random moment within `frequency` (e.g. every 4-12s), then for 80-250ms:
  - shifts 1-3 horizontal slices of the screen (duplicated layer + `clip-path: inset()` + `translateX`)
  - optional RGB split via offset `text-shadow`/`drop-shadow` in hue-shifted colors
  - tiny vertical jump of the whole screen
  - occasionally triggered on tab change for flavor
- **Flicker:** opacity keyframe 0.96-1
- **Roll bar:** a soft bright band sweeping top to bottom every `interval`
- **Glow / vignette / curvature:** CSS variables on the screen root

**Presets**

| Preset | Scanlines | Noise | Glitch | Flicker | Roll |
|---|---|---|---|---|---|
| OFF | off | off | off | off | off |
| SUBTLE | .15 | .04 | rare, weak | off | off |
| CLASSIC (default) | .25 | .07 | every ~8s, light | .02 | 8s |
| DAMAGED | .35 | .14 | every ~3s, strong + RGB | .05 | 4s |

**SYSTEM tab UI:** Pip-Boy style list (left) with a detail panel (right). Each effect has an on/off toggle and Pip-styled sliders (bracketed bars). Changes preview live; editing any slider switches the preset to CUSTOM. A "TEST GLITCH" button fires one glitch.

**Rules:** `prefers-reduced-motion` forces SUBTLE with no motion; effects pause when the tab is hidden; mobile caps noise at 12fps.

---

## 7. The 3D Vault Dweller

**Look:** The character renders in Pip-Boy monochrome to match the status screen. A post-process shader maps luminance to a 4-tone `--pip` ramp with light Bayer dithering and chunky pixels, so the 3D model and the headshot share one visual language.

**Pipeline**
1. `GLTFLoader` loads `/models/dweller.glb`; `AnimationMixer` plays the walk clip on loop
2. In-place walk: zero the root motion so the figure walks without leaving the frame. Slow camera orbit (±15°) for depth
3. Materials replaced with a vault-jumpsuit scheme (blue body, yellow trim, "111"-style number decal drawn on a CanvasTexture with the user's vault number). The post shader turns it green anyway, but the tonal contrast reads in the dither
4. Render target at low res (≈240×320), upscaled pixelated; capped at 30fps; paused when STAT isn't visible
5. `EffectComposer`: RenderPass → `PipMonochromeShader` (luma → 4 tones, dither, pixel size) → OutputPass

**Headshot replacement**
1. Upload (drag-drop or `<input accept="image/*">`), copy: "Vault-Tec reminds you: your photo never leaves this device."
2. Crop UI: drag + zoom inside a circle guide
3. Process: circular mask with soft edge, slight contrast boost, downscale to 256px; save as PNG data URL in the session store
4. In 3D: hide the model's head mesh (or scale the head bone's mesh to 0) and attach a **billboard plane** to the `Head` bone with the headshot as a `CanvasTexture`. It bobs with the walk but always faces camera, like a paper-doll head on a 3D body
5. It passes through the same monochrome shader, so it matches the body automatically
6. "REMOVE HEADSHOT" restores the default head

**Fallback if 3D slips:** 2D paper-doll Dweller in layered SVG (torso, arms, legs as separate groups) with a CSS/JS 8-frame walk cycle and the same head slot. Flat Pip-green fill + scanlines.

---

## 8. The Map

**Primary: MapLibre GL + OpenFreeMap vector tiles**
- Custom style JSON using OpenFreeMap's tile source: background `--screen-bg`, water as dim hatched green, roads as bright `--pip` lines with widths by class, buildings as thin outlines, labels uppercase in the UI font with glow
- Theme follows the SYSTEM hue (rebuild style colors on change)
- Player marker: pulsing chevron that rotates to device heading when available
- Controls: LOCATE (recenter), FOLLOW toggle (`watchPosition`), zoom +/- in Pip style, pinch and drag on mobile
- Header shows reverse-geocoded place name (Nominatim, cached in session) as `[ LEXINGTON, NC ]`
- Overlay card: temperature, conditions, RADS = UV index
- Attribution kept visible but styled small
- Lazy-load MAP so first paint stays fast

**Fallback:** Leaflet + OSM raster tiles with a CSS filter (grayscale → invert → sepia → hue-rotate to `--pip`) if vector tiles or WebGL fail.

**Location flow:** `navigator.geolocation` (HTTPS only) → if denied or timed out, Boston default + city search via Open-Meteo geocoding → saved in session.

---

## 9. Module contracts (original)

```ts
// lib/store.ts
export const persistence: 'session' | 'local' = 'session';
useStored<T>(key: string, initial: T): [T, (v: T) => void]   // prefix "pipboy:v1:"
resetAll(): void

// effects
useEffectsConfig(): [EffectsConfig, (patch: Partial<EffectsConfig>) => void]
applyPreset(name: EffectsConfig['preset']): EffectsConfig
triggerGlitch(strength?: number): void

// dweller
processHeadshot(file: File, crop: { x: number; y: number; scale: number }): Promise<string> // PNG data URL
<DwellerScene headshot?: string vaultNumber: string hue: number paused: boolean />

// map
useLocation(): { coords?: { lat: number; lon: number }; source: 'gps'|'search'|'default'; status: string; request(): void }
reverseGeocode(lat: number, lon: number): Promise<string>

// other
getWeather(lat, lon, units): Promise<Weather>
generateSpecial(seed: string): Record<'S'|'P'|'E'|'C'|'I'|'A'|'L', number>
parseBookmarks(html: string): Holotape[]
xpToLevel(xp: number): { level: number; progress: number }
createHack(seed: string, opts?): HackState; guess(s: HackState, w: string): HackState
wastelandDate(d: Date): string
```

---

## 11. Visual Spec

```css
:root {
  --pip-hue: 135;
  --pip:      hsl(var(--pip-hue) 100% 55%);
  --pip-hi:   hsl(var(--pip-hue) 100% 75%);
  --pip-60:   hsl(var(--pip-hue) 100% 55% / .6);
  --pip-30:   hsl(var(--pip-hue) 100% 55% / .3);
  --pip-15:   hsl(var(--pip-hue) 100% 55% / .15);
  --screen-bg: hsl(var(--pip-hue) 60% 4%);
  --glow: 0 0 2px var(--pip), 0 0 calc(10px * var(--glow-amt, 1)) var(--pip-60);
  --font-ui: 'Share Tech Mono', monospace;
  --font-display: 'VT323', monospace;
}
```

**Layout rules that make it read as a Pip-Boy**
- Top tabs evenly spaced; active tab in a thin bracket frame with notches
- Sub-tab strip slides, active label centered, neighbors dimmed
- Left list + right detail; selected row is an inverted bar
- Bottom bar: three framed boxes (HP | LEVEL + XP | AP)
- 1-2px rules, uppercase everything, glow on all type
- Micro-motion: list cursor eases between rows, numbers tick up, panels "type on"

---

## 12. Phase scope (feature prompts)

- **Phase 2 STAT + Dweller:** see §7; SPECIAL `generateSpecial(name)` seeded, 1-10 each, total 28-40, original descriptions; PERKS from app events; STATUS layout with Dweller center, limb bars around it, name + vault number, UPLOAD HEADSHOT action; PaperDollFallback if WebGL/GLB fails.
- **Phase 3 MAP + Weather:** see §8; Boston (42.3601, -71.0589, "THE COMMONWEALTH") fallback; city search `https://geocoding-api.open-meteo.com/v1/search?name=<q>&count=5`; Open-Meteo forecast `current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day` and `daily=sunrise,sunset,uv_index_max,temperature_2m_max,temperature_2m_min`, `timezone=auto`; WMO codes to uppercase labels (tested); RADS = UV index; STATS panel: clock, date, wastelandDate (year + 261), weather, day-cycle bar; useDeviceStatus for HP.
- **Phase 4 INV + Quests:** parseBookmarks (DOMParser, Netscape export, H3 folders, A links, skip `javascript:`, fixture test); holotapes list + detail, open in new tab with `rel="noopener"`; import, add, remove, search; fixed "ROBCO TERMINAL" holotape; AID pinned links with use counts; QUESTS add/complete/delete with difficulty, XP 10/25/50, xpToLevel (tested), LEVEL UP flash + triggerGlitch.
- **Phase 5 Terminal + Radio:** full-screen RobCo-style terminal (header, attempts as blocks, two columns of hex addresses + junk with embedded same-length words, likeness feedback, 4 attempts, bracket pairs remove a dud or restore attempts, side log, lockout and access-granted screens), mouse/touch/keyboard, daily (seed = YYYY-MM-DD) and random modes, daily streak = caps, `engine.ts` pure and tested, wrong guesses `triggerGlitch(0.3)`. Radio: original station names, Web Audio generators (drone, morse, static + tones), oscilloscope from AnalyserNode, "YOUR STATION" plays a local file; respects mute; pauses when hidden.
- **Phase 6 Integrate:** StatusBar wiring, sfx.ts, responsive pass at 375/430/768/1024/1440, lazy chunks, Lighthouse mobile ≥ 80, a11y, meta + og image, README.

---

## 14. Risks + Fallbacks

| Risk | Fallback |
|---|---|
| No suitable CC0 rigged model | Procedural Dweller / 2D paper-doll with the same head slot |
| Head bone/mesh hard to isolate | Billboard sits slightly in front of the head; scale head mesh to 0 |
| Three.js heavy on phones | Lower render res, 24fps, pause off-tab |
| Vector tiles or WebGL fail | Leaflet + OSM raster + CSS filter |
| Geolocation denied / LAN HTTP | Boston default + city search; test on Vercel previews |
| Nominatim slow or blocked | Show coordinates as `42.36°N 71.06°W` |
| Effects tank performance | Default to SUBTLE on mobile; noise 12fps |
| sessionStorage quota (headshot) | 256px PNG keeps it well under limits |
| Running out of time | Drop RADIO, AID, PERKS; ship shell + effects + Dweller + map + terminal |

---

## 15. Definition of Done

- [ ] Instantly reads as a Fallout Pip-Boy on desktop and phone
- [ ] Scanlines, glitch and background noise animate; every effect is adjustable in DATA > SYSTEM
- [ ] 3D Vault Dweller walks in a loop; uploaded headshot replaces the head
- [ ] Real map centers on the user's location, with follow, locate and weather
- [ ] Works with zero setup; customizations persist for the session; RESET clears them
- [ ] Quests/XP, holotapes and the terminal hack work
- [ ] No extracted game assets or verbatim game text; model license noted; disclaimer visible
- [ ] Lint, tests, build pass; live on Vercel
- [ ] 30-second screen recording

---

## 16. Demo Script (60 seconds)

1. Open on phone: Vault-Tec boot, scanlines and noise come alive
2. STAT: Vault Dweller walking; upload a selfie, your face is now on the Dweller
3. MAP: the map snaps to where you're standing, styled in Pip-Boy green
4. DATA > SYSTEM: crank to DAMAGED, hit TEST GLITCH, dial back to CLASSIC
5. INV: launch RobCo Terminal, crack the daily hack
6. Close: "A Fallout fan case study built in a day with Claude Code, no backend, free on Vercel."
