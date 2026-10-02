# Pip-Me Art Direction

The direction is drawn from five reference images (not shipped and not traced): a Fallout Shelter Pip-Boy panel, a FO3-style "notice" screen, a phone wallpaper, the "SPICE" amber CRT poster and the "PIXEL BLAST" green CRT mockup.

## What each reference teaches

| Ref | Keep | Apply to |
|---|---|---|
| **Shelter Pip-Boy panel** | A chunky physical device around the screen: olive/khaki painted body, side buttons, an analog dial. Selected list rows get **corner brackets** as well as a fill. Progress bars have an **angled lead-in**. A thick rule divides the header from the list. | Device body + knobs; selected-row brackets; XP/limb bars |
| **FO3 notice screen** | One continuous frame line that **breaks for a title** (top) and **for nav labels** (bottom, joined by dashes). Big, generously letter-spaced type. The selected bar is a lower-contrast fill with `>` before the label. Large filled shapes show **horizontal scan banding**. | Panel frames (`fieldset/legend` style), bottom status rail, selected row, Dweller fill |
| **Phone wallpaper** | A **glowing outline** that follows the device edge. A dim, textured green field with a soft vertical gradient. Limb ticks around the centered figure. An italic, heavy, slanted wordmark with an original tagline under it. | Screen rim glow, background texture, STAT layout (already close), **Pip-Me wordmark** |
| **SPICE CRT** | Real **curved glass**: bloom on bright strokes, a slight chromatic fringe, glass reflection, darker corners, a thick rounded bezel lit from above. Outline display type. Oscilloscope waveforms. | CRT glass layer, bloom tokens, outlined logo variant, RADIO |
| **PIXEL BLAST** | **Barrel curvature** with black overscan corners, a heavy vignette and a **dot-matrix/halftone** fill on display type. The pale "LCD green" end of the palette. | Curvature warp, halftone on logo/boot type, a new LCD color preset |

## System

**1. A flat UI shown on a curved CRT.** The UI is laid out flat at a constant size. A `CrtGlass` wrapper then:
- applies optional **barrel warp** using an SVG displacement filter. The map is generated at runtime, curvature `k` defaults to about 0.03, and it is off on touch/Safari for performance;
- clips to a rounded "tube" shape with black overscan;
- adds unwarped **glass layers** on top: inner edge shadow, top reflection streak, a faint second reflection, corner darkening and rim glow.

The warp only changes visuals. Hit-testing stays flat, so `k` stays small and interactive elements stay out of the extreme edges.

**2. The device (Pip-Me 3000).** A procedural, near-photoreal body in CSS/SVG:
- painted metal with a turbulence grain, bevels, worn edges, screws, a ridged grip and the embossed wordmark plate;
- **knobs** with knurled edges and brushed caps that rotate on drag, wheel or arrow keys: TUNING (hue, detents at presets), BRIGHTNESS (glow), SIGNAL (effects preset, a 4-position rotary), VOLUME;
- **switches/buttons**: SOUND, CURVE, DEGAUSS (a big glitch plus a wobble);
- **finish** swatches: OLIVE, GUNMETAL, RUST, BRASS.

There is a slot for a photographic texture (`/textures/bezel.jpg`) if a generated photo is added later.

**3. Camera.** There are two states, animated with one transform:
- **IN**: the screen fills the viewport, with the bezel lip visible on desktop.
- **OUT**: the whole device, centered, with its controls active.

A small **DEVICE** toggle on the screen frame (and the `Z` key) switches between them. In portrait the controls sit **under** the screen; in landscape they sit to the right.

**4. Pip-Me wordmark.** It's original, but it riffs on the italic speed-script energy of the Pip-Boy mark:
- heavy slab italic (Alfa Slab One, OFL, skewed);
- the hyphen stretched into a speed bar;
- an outline + inline-stroke variant (SPICE) and a halftone fill variant (PIXEL BLAST);
- the original tagline "PERSONAL INFORMATION PROCESSOR". No Vault-Tec gear emblem and no Vault Boy, ever.

**5. Phosphor tokens.**
- `--bloom` is a larger, softer glow used on display type and selected bars.
- `--fringe` is a ±0.5px warm/cool chromatic offset on large type, applied only when the glitch RGB option is on or the preset is DAMAGED.
- Color presets: GREEN 135, AMBER 38, BLUE 200, plus **LCD 85** (pale yellow-green).

## Rules
- No game assets, no Vault Boy, no Vault-Tec logo art. The references are for mood only.
- Everything stays driven by `--pip-hue` and the EffectsConfig, so the knobs and SYSTEM are two views of the same state.
- Respect reduced motion: no camera tween, no warp wobble, knobs snap.
