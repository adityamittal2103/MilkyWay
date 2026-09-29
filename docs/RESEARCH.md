# Phase 0: Reconnaissance

Research done before any production code. Observations are first-hand where marked (browsed or inspected on 25 Sep 2026); the rest comes from published references.

## 1. Mood Indigo, current site (moodi.org), first-hand

**What it is technically**
- A React/Vite shell (`assets/main-*.js`, about 100 KB) wraps an iframe (`/public-3d/index.html`) that runs vanilla **three.js r160**. The jsm modules load unbundled, one request per file.
- Post-processing chain: `OutlinePass`, `HalftonePass`, `UnrealBloomPass`, `RGBShiftShader`, `OutputPass`.
- Assets: `stage.glb`, `statue.glb`, `player.glb`, `logo.glb`, spray-can and boombox GLBs, graffiti PNGs, artist billboard JPGs, and a `music.mp3` track.
- Loading uses a **1.2 MB `loader.gif`**.
- Fonts: *Jersey 10*, *VT323* (pixel), *Rubik*, and a custom "sportsjersey".

**Opening experience and first viewport**
- There's no title sequence. You land directly in a third-person game: a witch-hat character on a yellow road, a synthwave magenta grid floor, a stage arch, floating balloons, and billboards showing headliners.
- An instruction card ("WASD to move · click to move camera · space to jump") sits over the scene.
- Navigation is split. Text links run across the top (Schedule, Events, Merch, Competitions, Sponsors, Contact). Pill buttons sit bottom-left (Headliners, Theme, About Us, History). A ticket-shaped **REGISTER!!** button sits bottom-right.

**Scroll, transitions, inner pages**
- The home has no scroll narrative. Exploration is keyboard or joystick driven.
- **Inner pages abandon the world entirely.** `/events` is a row of filter pills over a photo card grid. `/schedule` is date tabs plus category tabs over a table ("Coming Soon").
- Page changes are hard cuts.

**Mobile (375 × 812)**
- The same world with a virtual joystick, plus a halftone statue as the focal object. It's a direct port of the desktop game, not a separate design.

**Crawlability and accessibility**
- The home exposes only nav labels as text; everything else lives inside an iframe canvas.
- No reduced-motion alternative was observed.

### A. What MILKY WAY should borrow conceptually
- **The world is the homepage.** Visitors arrive in a place, not on a page.
- **Artists live inside the world** (billboards) instead of in a separate gallery.
- **A single, loud, ownable CTA shape.** The ticket-shaped Register button is instantly legible.
- **A committed art direction.** Street, graffiti and synthwave are held consistently across type, colour and props.

### B. What MILKY WAY should improve
- **Continuity.** The world must not end at the homepage. Every route in MILKY WAY moves the same persistent camera through the same universe, and transitions are travel.
- **Purposeful interaction.** Walking a character with WASD is fun but orthogonal to finding events. In MILKY WAY, every spatial gesture answers a question: *where is it? what is it? when is it?*
- **Loading.** Swap the 1.2 MB GIF for an SSR'd, zero-asset loader that reports real progress and tells you why you're waiting.
- **Crawlable content.** All meaningful text is real HTML over the canvas.
- **Mobile.** Design a distinct vertical, gesture-led experience instead of a joystick port.
- **Reduced motion and no-WebGL.** Full functionality without them.

### C. What MILKY WAY should deliberately avoid
- Game controls as the primary navigation.
- Pixel and jersey type, synthwave grid floors, and magenta-on-yellow. That palette and those tropes are Mood Indigo's.
- Post-processing stacks: halftone, RGB shift, and bloom over everything. We get glow from authored additive materials instead, which is cheaper and more controllable.
- Generic filter-pill and card-grid inner pages.

### D. Interactions that get stronger in a Deep Space context
- **Movement is the metaphor.** In space, travel *is* navigation: scroll becomes thrust and route changes become jumps.
- **Maps become star charts.** Venue zones become sectors, event categories become constellations, and days become orbits.
- **Scale reveals.** A galaxy can literally re-form into a building, and that is the "wait, this is Yashobhoomi" moment.
- **Gravity** is a natural hover language: particles bend around the cursor like lensing.

## 2. Mood Indigo across years (published references)
- Behance hosts a *Mood Indigo 2024 Brand Identity* project, a *My Mood Indigo 2025 | Website* project, an *Interactive 3D Mural, MI'19* project, and a competitions-site redesign.
- Recurring principles across years:
  1. A new theme world every year, with the identity rebuilt around it.
  2. Heavy illustration and 3D props.
  3. Maximalist colour.
  4. Headliners are the conversion hook.
  5. Register is always the loudest element.
- MILKY WAY keeps principles 1, 4 and 5. It deliberately inverts 2 and 3 into restraint: a near-black universe with *light* as the illustration.

## 3. High-end digital experiences: techniques worth translating
| Reference | Technique | Translation for MILKY WAY |
|---|---|---|
| Igloo Inc (Awwwards SOTY 2024) | Procedural particles, HUD typography, scroll-scrubbed camera | Galaxy↔venue particle morph, a mono HUD layer |
| Bruno Simon portfolio | Drivable vehicle *as* navigation | JUGAAD-1 ship carries you between routes, without WASD |
| Lusion (Oryzo, EverSwap) | Single object with inertia, Z-depth camera scroll | Scroll = thrust, and the camera has mass |
| Explore Primland | Scroll-controlled cinematic flythrough, fog | Journey chapters are camera keyframes, not pinned sections |
| Shopify Editions | Particle-dispersing typography | Wordmark width axis responds to velocity |
| Hubtown (Unseen) | Cursor reveal on a monolith | Cursor gravity lens on particles |
| Cartier Watches & Wonders | Web Audio scoring and hidden gesture rewards | Optional procedural audio, plus a ship easter egg |
| Common performance pattern (Utsubo 2026 roundup) | Meshopt/Draco, instancing, real HTML before 3D, mid-range testing | Adopted as non-negotiables |

## 4. Visual references distilled (not copied)
- **Astronomical atlases** (Bayer, Flamsteed): warm paper-white linework on dark fields, coordinate ticks, and small caps labels. This gives the *starlight* white, the tick marks, and the "RA/DEC-style" metadata.
- **NASA/JPL mission graphics and orbital diagrams**: thin ellipses, dotted trajectories, and mono metadata. This gives the Mission Timeline as orbits.
- **Wayfinding for large venues**: condensed caps, numbered sectors, and arrows. This gives the sector system on the venue map.
- **Retrofuturist civilian craft** (1970s NASA Ames colony art, Soviet space-age design): chunky, hand-built, friendly. Together with Indian *jugaad* engineering, this gives JUGAAD-1.

## 5. Motion principles (cinematic references)
Higgsfield generation was not used; generating clips would spend the user's credits. The principles come from the camera language of space cinema and title sequences:
- **Anticipation before acceleration.** The ship dips and holds before a boost, and the warp starts slow.
- **Scale via parallax layers.** Near dust, mid stars, and far galaxy move at different rates.
- **Reveal by light, not by fade.** The venue draws itself with a sweeping light front, and lights switch on sector by sector.
- **Camera has mass.** Everything is critically damped, with no linear tweens on the camera.
- **Varied easing and durations.** Snappy for UI (180–260 ms, expo-out), heavy for camera (1.4–2.4 s), and elastic only for the ship's antenna.

## 6. Venue facts used (sourced, minimal)
- Yashobhoomi is the India International Convention & Expo Centre (IICC) in Dwarka, New Delhi ([DPIIT/IICC](https://iiccl.dpiit.gov.in/about-us), [Wikipedia](https://en.wikipedia.org/wiki/Yashobhoomi)).
- Its exhibition halls are published as column-free, with a 72 m clear span and 200 m length ([IDOM](https://www.idom.com/en/project/yashobhoomi-convention-centre/)). The supplied model's hall footprint has a matching ~3:1 proportion. We do **not** claim which hall the festival uses.
- No other venue facts are asserted anywhere in the site.
