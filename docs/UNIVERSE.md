# The Milky Way universe: how it's built

## Hierarchy (and where each level lives)
| Level | What you see | Code |
|---|---|---|
| Universe | Near-black sky with faint colour fields, distant galaxies, a sun that flares every ~45 s | `cosmos/SkyField.tsx`, `vfx/Effects.tsx#Sun` |
| Galaxy | Barred spiral, R = 42,000: gold core, arms running violet → cyan, magenta knots, dark dust lanes | `cosmos/Galaxy.tsx`, `lib/galaxy.ts` |
| Orbit | The Yashobhoomi system: 5 worlds on real orbits, moons, an asteroid belt | `cosmos/Planets.tsx`, `cosmos/Debris.tsx`, `data/planets.ts` |
| Yashobhoomi | A floating station: deck, hull, lit seams, glowing orbital rings with pulses, masts | `cosmos/Station.tsx`, `StationCloud.tsx` |
| Festival zones | The hall from the `.blend`, 10 sectors, heatmap, beacons | `Venue.tsx`, `Sectors.tsx`, `data/zones.ts` |
| Events | Pins in the hall, satellites around worlds, stars in constellations, nodes on orbits | `EventMarkers.tsx`, `Planets.tsx#Satellites`, `Sky.tsx`, `Orbits.tsx` |
| Artists | Transmissions: portraits decoded from signal data | `Transmission.tsx`, `lib/transmission/*`, `components/artists/*` |

Yashobhoomi sits on an outer arm at 56% of the galactic radius, where the Sun sits in the real Milky Way.

**Depth layers**
1. Far: `SkyField` and `Sun`.
2. Mid: `Nebulae`, `Galaxy`, `Planets` and `Debris`.
3. Near: `Starfield` streaks and `Dust` motes.
4. Interactive: the station, venue, pins, constellations, orbits, the ship and transmissions.
5. UI: `WorldLabels` (projected DOM) and the HUD.

**Visual hierarchy is enforced, not hoped for.** Primary is the ship, the venue, the artist or the selected object. Secondary is the planets, constellations and markers. Tertiary is particles, nebulae and ambient detail. Background is stars, galaxy and dust.
- The galaxy dims itself when the hall is the subject (`uGlow × (1 − 0.42·markers) × (1 − 0.35·dim)`).
- On the artists network it is backdrop only.
- During a transmission the camera turns away from the sun into dark space (`TRANSMISSION_VIEW`).

## One camera authority
`components/world/CameraRig.tsx` is the only code that writes the camera. Every frame it resolves one owner, in strict priority:

| Owner | When | What happens |
|---|---|---|
| `system` | loader up | hold the boot view |
| `flight` | a planned flight (`lib/flight.ts`) is running | autopilot; user input is held, never mixed in |
| `cinematic` | home scroll, route presets | the director's key |
| `user` | explore / venue | the visitor pilots on top of the destination key |
| `idle` | user mode, no input for 9 s | a very slow drift |

- **Control transfers without jumps.** When the visitor's turn ends, their current view (orbit, zoom and pilot translation) is baked into the base key and the offsets are zeroed. The next owner starts from exactly what was on screen.
- **No one-frame lag.** After writing the pose the rig calls `camera.updateMatrixWorld()`, so the ship, labels, portal and every projection this frame use this frame's camera. Before this they lagged a frame and jittered at speed.
- **Dynamic near plane.** `clamp(dist × 0.0025, 1, 3)` gives more depth precision far out and never clips the ship.
- `live.camState` and `live.camView` (SPACE · GALAXY · APPROACH · ORBIT · LANDING · VENUE · ZONE · EVENT · DETAIL · TRANSMISSION · TRANSITION) are published for the HUD and diagnostics.

## Piloting
`NavInput.tsx` only records intent (`live.input`, `live.orbit`). The rig turns it into motion:

| Input | Action |
|---|---|
| W / ↑ | forward |
| S / ↓ | back |
| A / ← | strafe left |
| D / → | strafe right |
| E | up |
| Q | down |
| Shift | boost |
| + / − | zoom |
| R | return to the exploration orientation |
| Esc | back out one level |
| drag | orbit |
| wheel / pinch | zoom |
| right-drag / two-finger drag | move |

- **Basis from the camera, never world axes.** In the hall, forward follows the floor and Q/E set the altitude. In space it is the true 3D look direction.
- **Physics.** Input becomes a wish vector, normalised so W+A is never faster than W. Velocity then builds with acceleration (λ 3.2), cruises, and settles when released (λ 2.6). Speed scales with view distance, so the hall and the solar system feel equally flyable.
- **Bounds.** The hall keeps you over the deck. In space you stay within 4× the view distance of the destination.
- **Stuck keys are impossible.** Held keys are released on window blur, a hidden tab, focus entering a form field, ⌘ held (macOS swallows keyups), a dialog opening or leaving the mode. Keys are ignored in fields and with modifiers held.
- **Touch.** `touch-action: none` is applied on mount as well as on mode change, and the first touch decides "over the world" from its own target.
- **Ship feel** (`Ship.tsx`) reads `live.pilot`, the camera-local velocity:
  - It leads the camera slightly in the direction of travel.
  - It banks into strafes, dips its nose into thrust and lifts when climbing, through a damped spring (ζ ≈ 0.73), so it settles when you stop.
  - The engine answers the throttle, and the lens widens slightly with forward speed.
- **Cursor.** Becomes a heading chevron while piloting.

## Flicker-safe architecture
Measured, not assumed: `scripts/qa/flicker.mjs` (below). Against the previous build:

| Scene | Before | After |
|---|---|---|
| Inside the hall, slow scroll | 90% of screen flickering, 26 whole-frame flashes | 0.7%, 0 |
| Galaxy, slow scroll | 28% | 0.7% |
| Inside the hall, still | 9 flashes | 0 |
| Any scene, any tier, during route jump / filter change / resize | flashes seen | 0 flashes |

Causes found and fixed:

1. **Sub-pixel points.** A sprite under 3 physical px covers 1–4 pixels depending on sub-pixel position, so its brightness jumps as it moves. Every point shader now floors at 3 px (`stablePoint` in `system.ts`) and fades alpha instead. Hot-core highlights only exist on sprites big enough to sample them.
2. **1-px GL lines and hair-thin tori.** These crawl and cannot glow. Every orbit, ring, constellation, stem, edge and path is now a screen-space glow line (`vfx/glowLines.ts`): at least 3 px wide, a soft profile, antialiased dashes, and near-plane clipping.
3. **Hard `step()` patterns** (scanlines, dashes, windows, grids) aliased as the camera moved. They are replaced by `stripe` and `aaLine` (`AA_GLSL`), soft by one pixel, fading to their average when finer than a few pixels.
4. **Coplanar faces.** The deck sat 0.55 above the hull's top cap and z-fought from orbit; the hull no longer has a top cap and the deck is exactly the platform outline. Wall-base lines 0.1 above the floor are removed, the rim lines float in open air, and the wall caps carry an NDC depth bias.
5. **NaN pixels.** Degenerate derivative normals on silhouettes produced NaN, which smears through bloom as a whole-frame flash. The normals are guarded, and a sanitise pass (NaN/Inf → 0, clamp 24) runs before bloom.
6. **One-frame camera lag** for anything reading `camera.matrixWorld` (see above).
7. **Quality oscillation.** `PerformanceMonitor` was replaced by `QualityGovernor.tsx`:
   - It judges only outside loading, the intro, flights, warps, transmissions, resizes and hidden tabs, and only after a 2.5 s settle.
   - Stepping down needs 4 bad seconds; stepping up needs 30 good seconds and one step at a time.
   - Every change starts a 12 s cooldown, and after an up-then-down it never steps up again.
   - DPR is applied inside the frame and mirrored into the Canvas prop, since R3F re-applies the prop on re-render.
8. **Tier changes remounting the world.** Buffers are allocated once for `bootTier`; a lower `tier` only shrinks draw ranges and instance counts (`budget()`). Nebula octaves are a uniform, and the post pipeline is built once.
9. **Hard strobes.** The ship's nav lights and tail strobe, the mast lights, the 10 Hz flame flicker, the CSS `steps(1)` blinks and the 6.7 Hz animated film grain are now smooth envelopes, and the grain is static.
10. **Visibility pops.** Planets and the station fade and shrink over 30–40k units instead of vanishing at a threshold.
11. **Labels.** Hidden until first positioned, so they never flash at 0,0. The hover pickers have hysteresis, so the cursor and labels never flip-flop between neighbours.
12. **Canvas resize.** The world layer is sized to `100lvh`, so the mobile URL bar showing or hiding never reallocates the buffer.
13. **Warp travel precision.** Star parallax is quantised so the travel offset wraps on the CPU and shader values stay small forever.
14. **History navigation** (back/forward) arrives through the same warp as a jump, instead of an unmasked flight across the galaxy.
15. **Antialiasing on every post tier:** FXAA on medium (cheap on phones), SMAA on high and ultra. MSAA stays off; it produced blank output on some GPUs.

Principles in code: no geometry, material or `new` in `useFrame`; refs and shared uniforms for continuous values; stable keys; mutate, don't replace; dispose explicitly; one Canvas; the composer is never rebuilt.

### Diagnostic mode
Add `?debug` to any URL (`?debug=nopost,staticcamera` pre-sets switches). A separate chunk that normal visitors never download.

- **Readouts:** FPS and worst frame, DPR, quality and boot tier, governor state and reason, draw calls, programs, triangles and points, camera owner and view, world state, transition, flight and pilot speed, post-processing on/off.
- **Switches:** `DEBUG_NO_POST`, `NO_PARTICLES`, `NO_SHADOWS` (nothing casts shadows; enforced), `NO_TRANSPARENCY`, `NO_LABELS`, `NO_VFX`, `FIXED_DPR`, `FIXED_QUALITY`, `STATIC_CAMERA`, `STATIC_WORLD`.
- **How it hides things:** the visibility switches use render layers, so they never fight components that animate `.visible`.

## Artist transmissions
A reusable system: `data/artists.ts` (`Artist`: id, name, image, audio, genre, day, time, venue, colour, transmissionSeed, …) feeds:
- `/artists`: a signal network (`SignalNetwork.tsx`). Each node carries a live waveform; hover makes it louder, grows the node and shows metadata; click decodes.
- `/artists/[id]`: the decryption transmission (`TransmissionUI.tsx` in the DOM, `Transmission.tsx` in the world canvas).

**PHOTO → DATA** (`lib/transmission/portrait.ts`)
- Luminance, subject mask and relief are extracted. A cut-out's alpha is used if present; otherwise the background colour is estimated and an elliptical vignette applied, so the source rectangle can never show.
- Sobel edges find the contours.
- Particles are laid out as scanline strands along each face row, weighted by light, edges and a facial-attention prior. They follow contours, never a grid.
- Budgets: 7k / 16k / 26k / 38k particles by tier. Assets load only when a transmission opens, and everything is disposed on close.

**SIGNAL → FACE** (one shader)

| Time | Stage | What happens |
|---|---|---|
| 0–1.1 s | signal | a distant marker |
| 1.1–2.2 s | noise | static |
| 2.2–3.5 s | frequency lock | the static collapses onto the live carrier waveform (a three-depth glow ribbon + spectral bars) |
| 3.5–4.8 s | structure | the carrier splits into strands, each a waveform whose amplitude carries the face's light (a ridge plot of the portrait) |
| 4.8–6 s | contours | edge particles lock first |
| 6–7.2 s | identity | everything lands with relief |
| 7.2 s+ | stable | the portrait breathes; the camera moves slightly around it; fragments drift toward the viewer; the information is revealed |

**AUDIO → VISUAL** (`lib/transmission/signal.ts`)

| Signal | Visual |
|---|---|
| bass | large-scale breathing |
| mid | contour motion |
| treble | fine sparkle |
| amplitude | glow |
| transients | a spray of sparks (not a face-wide jump) |
| low energy | the portrait settles |

- **Sources.** The artist's own audio is analysed by a Web Audio `AnalyserNode` (track, voice, interview, soundbite, performance or festival audio). Without one, a deterministic synthetic transmission is built from `(seed, genre)`, with beats or voice-like syllables. It drives the visuals silently, and "Listen" plays it through the analyser. No artist audio is ever fabricated.
- **QA:** `?signal=quiet|loud|bass|treble|slow`.
- **Safety:** the face has a brightness floor and a fixed timeline, so it can never vanish or remain noise. The clock waits for the portrait, so no stage is skipped.
- **Placeholders.** Until the line-up is announced, `data/provisional/transmissions.ts` holds four clearly labelled test transmissions. Their faces are sculpted placeholder identities ray-marched from signed distance fields by `scripts/artists/bake-portraits.mjs`, not photographs of anyone. They are marked no-index, excluded from the sitemap, and disappear once `ARTISTS` has entries.
- **Accessibility.** The practical information is in the DOM from first paint and only visually revealed after reconstruction (immediately with reduced motion).
- **No WebGL.** The portrait is drawn as 2D scanline strands.

## Colour, glow and reactions
- **Palette** (`styles/tokens.css`, `COLOR`): base void / abyss / ink; primary electric violet, ultraviolet, deep blue, cyan; secondary magenta, hot pink, indigo; special solar orange (ship and Board only), warm white, acid lime, red. The specials are rare by rule.
- **Worlds:**

  | Planet | Category | Colours |
  |---|---|---|
  | Sonic | music | electric blue + cyan |
  | Kinetic | performance | magenta + violet |
  | Canvas | art | orange + violet |
  | Arena | competitions | blue with lime fractures |
  | Forge | workshops | indigo rock with amber seams |

  Every category and sector now has its own hue.
- **Planets:** moving clouds, night-side light clusters in the world's colour (they fade before going sub-pixel), moon shadows, a warm terminator band and atmospheric rims.
- **Glow:** stronger thresholded bloom (dark space stays dark); glow lines for every ring, orbit and constellation, with energy pulses travelling along the station rings, planet orbits and schedule rings.
- **World reactions** (`lib/fx.ts`, timestamped envelopes):

  | Trigger | Reaction |
  |---|---|
  | filter | a colour field sweeps the hall from its centre; sectors heat as the wavefront reaches them; matching markers pulse; planets flare; stars and nebulae swell; the dial locks and sends a pulse ring; ≈ 0.9 s |
  | select planet, event or sector | an energy path draws from the ship to the target, then the flight engages |
  | landing | shockwave, burst, venue light surge |
  | constellation found | the nebulae answer |

- **Cursor:** small star (default), orbital ring (hover), reticle (target), heading chevron (move), live waveform (transmission), navigation marker (destination), boarding lock (register).
- **Motion speeds:** micro 200 ms, interaction 450 ms, transition 1 s, cinematic 2.4 s, epic 6 s, each with its own easing (`--ease-io`, `--ease-anticipate`, `--ease-land`, …).

## Performance
- **Four tiers** (`QUALITY`) with a budget for every cost; buffers are allocated for the boot tier.
- **Initial JS** is about 205 KB gzipped on every route (three.js, the world, transmissions, glow lines and debug are lazy chunks).
- **Lighthouse,** production build, local, alternating runs against the previous build:

  | | Performance | Accessibility | Best practices | SEO |
  |---|---|---|---|---|
  | Desktop | 97–98 (unchanged) | 100 | 100 | 100 |
  | Mobile (simulated slow 4G, 4× CPU) | 76–81, median 78 (previous build 79–85, median 80; within noise) | 100 | 100 | 100 |

  Test transmission pages score 66 for SEO by design: they are no-index until real artists exist.

## QA tools (`scripts/qa`)
| Script | What it does |
|---|---|
| `flicker.mjs <url> <out>` | frame-stability meter: area-averaged block luminance, up-down-up spikes, whole-frame flashes, and a heatmap PNG. Options: `SCROLL=px/frame`, `KEY=KeyW`, `ACT='js'` / `RESIZE=WxH` mid-capture |
| `input.mjs <base> <route>` | 23 checks: every movement key in the camera's own frame, diagonals ≤ single-axis speed, key repeat, smooth release, stuck-key paths, typing in fields, mouse + keyboard, R |
| `touch.mjs` | one-finger orbit, two-finger move, pinch zoom on a phone |
| `transmission.mjs <base> <id> <out> [w h mode times…]` | frames of a reveal at chosen moments |
| `responsive.sh <path> <name>` | the seven QA viewports |
| `shoot.mjs`, `profile.mjs` | screenshots and CPU profiles |

## Self-critique (God Mode 3)
1. **Is every visible flicker gone?**
   - Every one I could find and measure is gone.
   - No whole-frame flash in any scene, tier, transition, resize or filter change. Still scenes read 0.1–0.2, the hall under slow scroll about 1.
   - What still registers is real motion: fast flights and warps.
   - Headless Chrome on one Mac is not every GPU, so check a mid-range Android and an older iPhone.
2. **Do W/A/S/D all work?** Yes, 23/23 input checks in space and in the hall. The old W/S failure had two causes: at space level W/S only tilted the view, and in the hall a floating-point wall check zeroed forward velocity.
3. **Does flight feel physical?** Acceleration, cruise and settle, plus bank, pitch, lead and engine response. Tuning is subjective: the numbers live in `CameraRig.tsx` and `Ship.tsx`.
4. **Does the artist reveal feel like a signature moment?** Yes. The strands stage (the face as a ridge plot of waveforms) is the moment.
5. **Does the face come from signal data?** Yes: the particles travel from the carrier waveform into strands into the face.
6. **Does audio drive it?** Yes, with analysed audio when listening, and the same mapping from the synthetic signal when silent.
7. **Are the portraits real?** Not yet. They are sculpted busts, honest placeholders; real photos (ideally cut-outs) will look better.
8. **Colour, glow, galaxy, planets?** Much richer, and the hierarchy is kept by dimming the background where the subject needs it.
9. **Does it still feel tasteful?** The specials are rare and dark space dominates. The lime on Arena was pulled back once already; watch it.
10. **Weak spots still open:**
    - The events and artists are provisional.
    - Sound and signal need a real listening test with speakers.
    - Frame pacing still needs a real-device check.
