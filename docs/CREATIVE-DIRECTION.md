# Creative Direction: MILKY WAY

## The idea in one line
**The festival floor plan is drawn in stars.** You pilot a student-built ship into the Milky Way. The galaxy's arms collapse and redraw themselves as the hall at Yashobhoomi, and every part of the festival (zones, events, days) is a place you can fly to.

## Why this is ours and not a template
- **The venue is the hero asset**, not a backdrop. The 3D map is built from the supplied `.blend` floor plan, so the reveal ("wait, this is Yashobhoomi") is literal.
- **The Milky Way is a barred spiral.** Our galaxy has a central bar and two major arms, because that is what the Milky Way actually looks like. It is not a generic swirl.
- **Warmth equals people.** The universe is cold (void, ink, ion blue). The only warm things are human: the ship's saffron engine, the fairy-light curtain in the hall, and your boarding pass.
- **Jugaad.** The ship is improvised Indian engineering: mismatched engines, a dish "for the aux cable", a whip antenna that wobbles. That's youth culture, not NASA.

## Ship: JUGAAD-1 (hull code MW-01)
A student-built interdimensional festival craft.
- An egg-shaped lathe hull with the cockpit bubble offset to port, so the silhouette is asymmetric.
- **Mismatched engines:** a big salvaged main thruster to starboard and a small one to port. The exhaust is saffron flare.
- A dish on the dorsal spine, a spring-physics whip antenna with a blinking tip, and stubby fins of different sizes.
- Port red and starboard green nav lights, plus an orbital "halo" ring antenna.
- Behaviour: banks with camera velocity and mouse, engine intensity follows scroll speed, idles with a breathing bob, and does a barrel roll when clicked.

## Colour system (hierarchy matters more than hues)
| Token | Hex | Role | Budget |
|---|---|---|---|
| `--void` | `#030409` | Page and space background | ~70% |
| `--abyss` | `#0A0F1F` | Deep navy planes, map floor | ~15% |
| `--ink` | `#141A33` | Architecture bodies, rules | ~8% |
| `--starlight` | `#F1EDE4` | Type, linework (warm paper white, like an atlas) | primary type |
| `--dust` | `#8B90A6` | Secondary text, metadata | secondary |
| `--ion` | `#5B8CFF` | **Interactive**: links, hovered sectors, focus | accents |
| `--pulsar` | `#FF3E9A` | Energy: hover bursts, live states. Never large fills | <2% |
| `--flare` | `#FF7A1A` | **Rare**: the ship's engine and the Board action only | <1% |

Forbidden: purple gradient backgrounds, glassmorphism panels, and neon on everything.

## Typography
| Role | Face | Why |
|---|---|---|
| Display (MILKY WAY, section titles) | **Anybody** (variable `wdth` 50–150, `wght` 100–900) | The width axis carries the signature interaction: **the wordmark stretches with velocity like light at warp**. It's condensed at rest and extended at speed. |
| Text | **Instrument Sans** (variable) | Clean, contemporary grotesk that stays out of the way |
| Technical | **IBM Plex Mono** | HUD metadata, coordinates, timecodes. Its IBM/aerospace lineage fits |
| Editorial whisper | **Instrument Serif** *italic* | Used rarely for human asides ("a youth cultural universe") |

Rules: display always uppercase with tight leading (0.82). Mono always uppercase at +0.08em tracking. The serif is never used for UI.

## Graphic system (all coded, no icon sets)
- **Insignia:** the galactic plane is a horizontal rule. **M** sits above it and its reflection, **W**, sits below. MILKY WAY is one letter and its mirror.
- **Sector glyphs:** each venue sector gets a mark built from the same orbital primitives (ring, dot, arc, tick).
- **Star-chart ticks:** coordinate rulers along the map edges, derived from the actual model coordinates.
- **Boarding pass:** a perforated ticket with a mono manifest and a tear line.

## Motion language
| Type | Duration | Ease |
|---|---|---|
| UI (hover, focus, menus) | 180–260 ms | `expo.out` |
| Type reveals | 700–1100 ms, 40–60 ms stagger | `power4.out` via masks |
| Camera | Critically damped springs (λ 2.2–3.5) | none; it has mass |
| Warp (route change) | 650 ms in, 900 ms out | `power3.in` / `expo.out` |
| Ship antenna | Spring physics | underdamped (the only bouncy thing) |

## The wow moments (designed, not accidental)
1. **Cold open.** Black and static, with one warm point of light that becomes the ship.
2. **Warp.** Stars stretch into streaks, and the wordmark's width axis stretches with them.
3. **The galaxy redraws itself.** 60k particles leave the barred spiral and land on the hall's walls: "WAIT. THIS IS YASHOBHOOMI."
4. **Lights on.** The model's real 2,227-bulb fairy-light curtain twinkles on, sector by sector.
5. **Sector scan.** Hovering the map lights the floor, rings the sector with orbiting dust, and leans the camera in.
6. **Constellation events.** Hovering a star draws its constellation. Clicking flies there and events bloom.
7. **Orbital timeline.** Days are orbits and events ride them. A time cursor sweeps.
8. **Boarding.** Registration docks the ship at the Docking Bay (the real entry sector) and prints a pass.
9. **Cursor gravity.** Particles bend around the pointer like lensing.
10. **Every route is a jump.** Warp, a portal ring, and arrival.
11. **Sound on (optional).** A procedural engine hum pitched by velocity and radio chirps on hover.
12. **Jugaad easter egg.** Click the ship and it barrel-rolls, and the antenna flails.
