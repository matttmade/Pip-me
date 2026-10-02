# Pip-me: Build Plan

Execution plan for the Pip-Boy Personal Terminal (the source spec is `pipboy-plan.md`).
It turns the spec into an ordered build with clear ownership, interface contracts that
are fixed before work splits up, and a cut line that still ships a working demo.

---

## 0. Where we are vs. the spec

| Spec assumes | Reality | Adjustment |
|---|---|---|
| Repo `pipboy-personal` | Repo is `matttmade/pip-me`, empty, branch `master`, no commits | Rename the default branch to `main` on the first commit; keep the product name "Pip-Boy Personal Terminal" |
| Start at 8:15 | It's past 12:30 already | Compressed schedule below; build the demo-safe cut first, add extras after it |
| `public/models/dweller.glb` downloaded in prep | No model in the repo | Ship a **procedural Dweller** first (see §4). Swap in the GLB as an upgrade when someone adds one |
| `/reference` screenshots | None in the repo | Use the §11 layout rules. If screenshots are added later, run a fidelity pass only |
| 4 humans running parallel worktrees | One cloud session | Parallel phases run as isolated sub-agents (git worktrees), one per feature branch, with the same file ownership rules |
| Vercel deploy by you | No Vercel access from here | I push branches; you connect the repo in Vercel once and every branch gets a preview URL |

Node 22 / npm 10 are installed. Network reach to OpenFreeMap, Open-Meteo, Nominatim and npm
gets checked in Phase 0 by actually installing and fetching, not assumed.

---

## 1. Compressed schedule (from ~12:45)

| Block | Work | Output |
|---|---|---|
| 12:45-1:15 | **P0** scaffold, CLAUDE.md, contracts, CI scripts | `main` builds, you hook up Vercel |
| 1:15-2:15 | **P1** shell + effects engine + SYSTEM | Reads as a Pip-Boy, effects tunable |
| 1:45-3:15 | **P2-P5** in parallel worktrees (start once P1's contracts land) | 4 feature branches |
| 3:15-3:45 | **P6** merge, StatusBar wiring, sfx, responsive, perf | Integrated `main` |
| 3:45-4:00 | **P7** reviewer pass, final deploy, you record the demo | Live URL + recording |

If time runs short, cut in this order: RADIO → AID → PERKS → sfx → Leaflet fallback →
crop UI (center-crop automatically instead). **Never cut:** shell, effects, walking
Dweller with headshot, live map, Terminal hack, disclaimer.

---

## 2. Phase 0: Scaffold (lead)

1. `npm create vite@latest . -- --template react-ts`; add `three`, `maplibre-gl`, `leaflet`,
   `@fontsource/share-tech-mono`, `@fontsource/vt323`, dev `vitest`, `jsdom`, `@types/three`,
   `@types/leaflet`.
2. Scripts: `dev`, `build` (`tsc -b && vite build`), `lint`, `test` (`vitest run`),
   `check` = lint && test && build.
3. `CLAUDE.md` from spec §10, plus one added rule: *"Shared contracts live in
   `src/lib/contracts.ts`; feature branches consume them and never change their signatures."*
4. Save the source spec as `pipboy-plan.md`. `.gitignore`: `/reference`, `dist`, `node_modules`.
5. Folder tree from spec §9 with placeholder files, `tokens.css` from §11, and an
   "INITIALIZING" screen with the footer disclaimer.
6. `vercel.json` is not needed (Vite defaults). Add a SPA fallback only if routing is added.
7. Commit on `main`, push. **You:** Vercel → Add New Project → import `pip-me` → Deploy.

**Gate:** `npm run check` passes on a clean clone.

---

## 3. Phase 1: Shell, effects, SYSTEM (lead)

Spec §5, §6 and §11 as written. Before work splits, this phase also has to fix the
**integration seams**. These are the files that let four branches merge without conflicts:

### 3.1 Contracts fixed in P1 (`src/lib/contracts.ts` + stubs)

```ts
// storage: the only module that touches web storage
useStored<T>(key, initial): [T, (v: T | ((p: T) => T)) => void]
resetAll(): void

// effects
useEffectsConfig(): [EffectsConfig, (patch: Partial<EffectsConfig>) => void]
triggerGlitch(strength?: number): void            // callable from anywhere, no hook needed

// app events (perks, XP and sfx all listen here)
type AppEvent =
  | { type: 'quest-complete'; xp: number } | { type: 'level-up'; level: number }
  | { type: 'headshot-set' } | { type: 'hack-result'; success: boolean; daily: boolean }
  | { type: 'holotape-import'; count: number } | { type: 'tab-change'; tab: string }
  | { type: 'map-located' } | { type: 'radio-tuned'; station: string };
emit(e: AppEvent): void;  on(type, fn): () => void

// status bar feeds: P1 ships stubs returning defaults, features replace the bodies
useBattery(): { level: number; charging: boolean }           // P3 owns
useXp():      { xp: number; level: number; progress: number } // P4 owns
useDaylight(): { remaining: number; total: number }          // P3 owns
useCaps():    number                                         // P5 owns

// overlays: full-screen views launched from anywhere
openOverlay(id: 'terminal' | 'headshot-crop'): void; closeOverlay(): void
```

### 3.2 Tab files are thin routers

`DataTab.tsx` (and the others) only switch sub-tabs, which removes the spec's P3/P4
collision on `DataTab.tsx`:

```
tabs/DataTab.tsx  → features/quests/QuestsPanel.tsx   (P4)
                  → features/clock/StatsPanel.tsx     (P3)
                  → tabs/SystemPanel.tsx              (P1)
tabs/InvTab.tsx   → features/holotapes/*Panel.tsx     (P4)
tabs/StatTab.tsx  → features/dweller|special|perks    (P2)
```

P1 creates every panel file as a stub that renders "OFFLINE". Feature branches only fill
in their own files.

### 3.3 Effects engine notes

- Each layer is its own component behind a `pointer-events: none` overlay. Every value flows
  through CSS variables set on the screen root, so changing a slider never re-renders content.
- `glitchScheduler.ts` is pure: `nextDelay(cfg, rng)` and `makeGlitch(cfg, rng) → { slices, dx, dy, rgb, duration }`.
  It's tested with a seeded RNG. The DOM layer only applies its output.
- Glitch slices: CSS has no portable way to mirror live DOM (`element()` is Firefox-only),
  so during the 80-250ms burst, mount 1-3 absolutely positioned clones of the active panel,
  each with a `clip-path: inset()` slice and a `translateX`. They unmount right after.
  Canvas content (Dweller, map) shows as an empty slice, which reads as signal dropout.
  *Fallback if clones are costly:* glitch the overlay only (bright offset bars plus an RGB
  `drop-shadow` on the root) and add a vertical jump to the whole screen.
- Reduced motion: default to SUBTLE with drift, roll and glitch off. The user can still
  override it in SYSTEM, because the setting is a default, not a lock.
- `visibilitychange` pauses the noise canvas, the glitch timer, three.js, radio and the map
  `watchPosition`. One `usePageVisible()` hook in `lib/` handles all of them.

### 3.4 Gate (before forking P2-P5)

- [ ] All five tabs and sub-tabs work by keyboard (Q/E, A/D, arrows, Enter) and by touch
- [ ] Every effect changes visibly from SYSTEM and survives a reload; RESET clears it
- [ ] Contracts and stubs committed; `npm run check` green; preview deploy looks right

---

## 4. Phase 2: STAT + Dweller (parallel A, highest risk)

**Main de-risking change:** build the Dweller in two layers, so a walking figure exists
within the first 30 minutes whether or not a GLB ever arrives.

1. **Procedural Dweller (ships first).** A low-poly humanoid built from three.js primitives
   (capsules and boxes) on a real `Skeleton` with named bones (`Hips`, `Spine`, `Head`,
   `UpperLeg.L`…). The walk is a code-driven sine cycle (hip sway, leg and arm swing,
   bob). It's 100% original, needs no asset licensing, and is guaranteed to have a
   `Head` bone.
2. **GLB upgrade (optional).** If `public/models/dweller.glb` exists (Quaternius CC0
   recommended), load it, find the walk clip by name (`/walk/i`), and strip root
   translation from the `Hips` position track. The head-slot code is shared because
   both paths expose a `Head` bone.
3. **Look.** Jumpsuit colors in material, a CanvasTexture vault-number decal, and
   `EffectComposer` → `PipMonochromeShader` (luma → 4-tone hue ramp, 4×4 Bayer,
   `pixelSize`) → OutputPass. Render at 240×320 with `image-rendering: pixelated` and a
   30fps cap, paused when STAT is hidden. The camera orbits ±15°.
4. **Headshot.** Upload → crop overlay (drag/zoom in a circle) → `processHeadshot` (circle
   mask with feathered edge, contrast ×1.15, 256px PNG data URL). Hide the head mesh
   (`visible=false`, or scale it to 0) and parent a billboard plane to `Head` that faces the
   camera each frame. REMOVE restores the head.
   - Use `<input type="file" accept="image/*">` **without** `capture="user"`. `capture`
     forces the camera on phones and blocks choosing an existing photo. Phones offer the
     camera anyway.
   - `processHeadshot` testing: split it into a pure `computeCropRect(img, crop, out)` that
     gets unit tests, and a canvas wrapper. jsdom has no real canvas, so test the math, not
     the pixels.
5. **SPECIAL / PERKS.** `generateSpecial(name)` uses a seeded RNG and redistributes points
   so each stat is 1-10 and the total is 28-40. Tests cover the bounds over 1,000 random
   seeds. Perks subscribe to `on(...)` events.
6. **Fallback.** If WebGL is unavailable (`WebGLRenderingContext` check or a context-loss
   event), show `PaperDollFallback` (SVG plus a CSS walk) with the same head slot.

**Owns:** `features/{dweller,special,perks}`, `tabs/StatTab.tsx`.

---

## 5. Phase 3: MAP + weather + clock (parallel B)

- **Style.** Start from OpenFreeMap's hosted style JSON (verify the URL at build time:
  `https://tiles.openfreemap.org/styles/liberty`). Keep its `sources`, `glyphs` and
  `sprite`, and **recolor its layers programmatically** by matching layer `id` / `source-layer`
  (water, landuse, transportation, building, place). That's faster and sturdier than writing
  a style from scratch.
  - Map labels can't use Share Tech Mono: MapLibre needs glyph PBFs. Use the hosted
    glyph fonts, set `text-transform: uppercase`, and use `text-halo-color` for the glow.
  - Water hatching: `map.addImage('hatch', canvasImageData)` + `fill-pattern`.
  - When the hue changes, call `setPaintProperty` per layer rather than `setStyle`, which
    avoids re-downloading tiles.
- **Location.** `useLocation` goes geolocation (8s timeout) → stored override → Boston
  default. City search uses Open-Meteo geocoding. FOLLOW uses `watchPosition`, cleared when
  hidden. Heading comes from `coords.heading`, falling back to `deviceorientation` (iOS
  needs a permission call on a tap).
- **Reverse geocode.** Nominatim allows at most 1 request/second. Cache by coordinates
  rounded to 3 decimals in the store. On failure, show `42.36°N 71.06°W`.
- **Weather.** Open-Meteo with the spec's fields. `wmoToLabel` gets tests. RADS = UV max.
  Refresh every 15 minutes while visible.
- **Fallback.** If `maplibregl.supported()` is false or the style errors, use
  `LeafletFallback` (OSM raster tiles with a CSS filter chain).
- **Also owns:** `StatsPanel`, `wastelandDate` (tested: 2026 → 2287), `useBattery` (Battery
  API is Chromium-only, others report 100/100), and `useDaylight` from sunrise/sunset.

**Owns:** `features/{map,weather,clock,device}`, `tabs/MapTab.tsx`.
**Test on the Vercel preview URL**, since geolocation needs HTTPS on the phone.

---

## 6. Phase 4: INV + quests (parallel C)

As in the spec, plus:
- `parseBookmarks`: fixture test with nested folders, `javascript:` links skipped, and
  duplicate URLs merged.
- The fixed ROBCO TERMINAL holotape calls `openOverlay('terminal')`. It doesn't import
  terminal code, so the branch has no dependency on P5.
- `xpToLevel`: a simple curve, `xpForLevel(n) = 50·n·(n-1)/2`, with tests at the
  boundaries. Level-up calls `emit({type:'level-up'})` and `triggerGlitch(0.6)`.
- Fills in `useXp`.

**Owns:** `features/{holotapes,quests}`, its panels.

---

## 7. Phase 5: Terminal + radio (parallel D)

- `engine.ts` is pure: `createHack(seed, {wordLength, count})`, `guess`, `useBracket`.
  Tests cover likeness, dud removal, the attempt reset, lockout, and determinism for the
  daily seed. Write `words.ts` as an original word list of 7-letter, all-caps words.
- `Terminal.tsx` registers as the `'terminal'` overlay. Feedback is typed on at a fixed
  cadence.
- `useCaps` holds the daily streak: increment once per date on a daily success, and reset
  if a day is skipped.
- Radio: start the AudioContext on a user gesture. Each station is a node graph factory
  returning `{ output, stop }`. An oscilloscope canvas reads from an AnalyserNode.
  YOUR STATION uses `URL.createObjectURL(file)` (not persisted).

**Owns:** `features/{terminal,radio}`, `tabs/RadioTab.tsx`.

---

## 8. Phase 6: Integrate (lead)

1. Merge order: `inv-quests` → `terminal-radio` → `map` → `dweller`. Run `npm run check`
   after each merge.
2. Swap the StatusBar stubs for the real hooks (they should already be wired through the
   contracts, so this is a check).
3. `sfx.ts` listens on the event bus plus tab and list navigation, and respects mute.
4. Responsive pass at 375/430/768/1024/1440 using a Playwright script that screenshots
   each tab at each width (Chromium is preinstalled). Watch for horizontal scroll.
5. Perf: check that `three` and `maplibre-gl` load as separate chunks in
   `dist/assets`, and that Lighthouse mobile scores 80 or higher.
6. A11y, meta tags, og image (Playwright screenshot of STAT at 1200×630), favicon, README
   (disclaimer, privacy, model source and license).

---

## 9. Phase 7: Review

A fresh sub-agent reviews against `CLAUDE.md` and spec §15, and runs `/code-review` and
`/security-review` on the diff since P0. Specific greps:
- `localStorage|sessionStorage` outside `src/lib/store.ts`
- `fetch(` calls going anywhere other than OpenFreeMap, Open-Meteo or Nominatim
- No files under `/reference` in git

---

## 10. Testing matrix (pure modules, Vitest)

| Module | Key cases |
|---|---|
| `store` | prefix, JSON round-trip, `resetAll` clears only `pipboy:v1:*`, quota error caught |
| `seed` | determinism, distribution sanity |
| `presets` | every preset is a full config; editing a slider → CUSTOM |
| `glitchScheduler` | delays within range; strength scales offsets; reduced motion → none |
| `generateSpecial` | 1-10 per stat, total 28-40, deterministic |
| `processHeadshot` (crop math) | clamping, zoom, aspect ratios |
| `wmoToLabel`, `wastelandDate` | known codes, unknown code fallback, year offset |
| `parseBookmarks` | fixture, nesting, `javascript:` skipped |
| `xpToLevel` | boundaries, progress 0-1 |
| `terminal/engine` | likeness, brackets, lockout, daily determinism |

---

## 11. Risks specific to this run

| Risk | Mitigation |
|---|---|
| Late start | Demo-safe cut first; strict cut order in §1 |
| No GLB | Procedural rigged Dweller is the default; GLB is optional |
| Merge conflicts across parallel branches | Contracts and stub panels fixed in P1; branches only touch their own folders |
| Outbound hosts blocked from the sandbox | Only affects local testing; the browser calls these APIs directly, so verify on the Vercel preview |
| Glitch content duplication is costly | Overlay-only glitch fallback (§3.3) |
| OpenFreeMap layer ids change | Recolor by `source-layer` match, not hardcoded ids; unknown layers get dimmed |
