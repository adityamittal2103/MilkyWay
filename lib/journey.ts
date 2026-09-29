import { ZONES, zoneById } from '@/data/zones'
import { EVENTS } from '@/data/provisional/events'

/**
 * Pure chapter + placement math shared by the DOM and the world (no three.js here, so the
 * DOM layer can import it without pulling the 3D engine into the first page load).
 */
const ramp = (p: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/*
 * Home journey: eight chapters over 10 viewport units (approach + Yashobhoomi are 1.5 tall,
 * the universe inside is 2). Scroll range = 9 units. Stops are where a section fills the screen.
 */
export const JOURNEY_UNITS = 9
export const CHAPTER_UNITS = [
  { id: 'void', u: 0, h: 1 },
  { id: 'galaxy', u: 1, h: 1 },
  { id: 'milkyway', u: 2, h: 1 },
  { id: 'approach', u: 3, h: 1.5 },
  { id: 'yashobhoomi', u: 4.5, h: 1.5 },
  { id: 'landing', u: 6, h: 1 },
  { id: 'inside', u: 7, h: 2 },
  { id: 'explore', u: 9, h: 1 },
] as const

/** where JUGAAD-1 sits in camera space per chapter: always opposite the copy */
const SHIP_LAND: [number, number, number][] = [
  [0.0, -0.35, -8], // void: the ship is the only thing there
  [1.9, -0.95, -9.5], // galaxy: copy left
  [2.5, 1.25, -11.5], // milky way: the wordmark owns the frame
  [-2.1, -0.75, -9], // approach: copy right → ship left, engines hot
  [1.5, -1.55, -10.5], // yashobhoomi: type holds three corners → ship bottom-right
  [-2.2, -1.25, -9], // landing: copy right
  [-2.9, -1.55, -10.5], // inside: list right
  [-2.9, -1.55, -10.5],
  [3.3, 1.55, -11], // explore: copy centred → ship high right, in open sky
]
// portrait / phones: chapter copy is bottom-anchored, so the ship lives in the open sky above it
const SHIP_PORT: [number, number, number][] = [
  [0.0, 0.0, -10], // void: centre stage
  [0.0, 2.2, -13],
  [0.0, 2.4, -13.5],
  [0.0, 2.2, -13],
  [0.0, 0.4, -12.5], // yashobhoomi: type holds top + bottom
  [0.0, 2.2, -13],
  [0.0, 0.9, -14], // inside: heading top, list bottom
  [0.0, 0.9, -14],
  [1.0, 3.9, -15], // explore: tucked into the top corner above the heading
]
const SHIP_U = [0, 1, 2, 3, 4.5, 6, 7, 8, 9]
export function journeyShip(u: number, portrait: boolean): [number, number, number] {
  const K = portrait ? SHIP_PORT : SHIP_LAND
  let i = 0
  while (i < SHIP_U.length - 2 && u > SHIP_U[i + 1]) i++
  const t = ramp((u - SHIP_U[i]) / (SHIP_U[i + 1] - SHIP_U[i]), 0.2, 0.85)
  const a = K[i]
  const b = K[i + 1]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** which sector the "universe inside" chapter points at (shared by map + DOM list) */
export function exploreIndex(u: number) {
  if (u < 6.9 || u > 8.7) return -1
  const t = Math.min(0.999, Math.max(0, (u - 7.0) / 1.55))
  return Math.floor(t * ZONES.length)
}


/** each event's pin position on the hall floor, inside its sector (plain {x, z}) */
function anchorXZ(slug: string) {
  const e = EVENTS.find((x) => x.slug === slug)!
  const z = zoneById(e.zone)!
  const same = EVENTS.filter((x) => x.zone === e.zone)
  const i = same.indexOf(e)
  const cols = Math.ceil(Math.sqrt(same.length))
  const rows = Math.ceil(same.length / cols)
  const w = z.rect[2] - z.rect[0]
  const d = z.rect[3] - z.rect[1]
  return { x: z.rect[0] + ((i % cols) + 0.5) * (w / cols), z: z.rect[1] + (Math.floor(i / cols) + 0.5) * (d / rows) }
}
export const EVENT_XZ = new Map(EVENTS.map((e) => [e.slug, anchorXZ(e.slug)]))
