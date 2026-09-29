import { EVENTS, type FestEvent } from './provisional/events'

/**
 * The five worlds of the Yashobhoomi system. Each groups related event categories. They are
 * landmarks first (you navigate by them) and indexes second (click one to see what it holds).
 * Positions are orbits around the station, so the system reads as one place, not scattered props.
 */
export type PlanetKind = 'giant' | 'ocean' | 'marble' | 'ice' | 'forge'
export type Planet = {
  id: string
  name: string
  group: string
  line: string
  kind: PlanetKind
  radius: number
  orbit: number // distance from the station
  angle: number // around the station (radians, 0 = +X)
  height: number // above/below the system plane
  colors: [string, string, string] // deep, mid, highlight
  atmosphere: string
  ring?: { inner: number; outer: number; tilt: number; color: string }
  moons: { name: string; radius: number; dist: number; speed: number; phase: number; incline: number }[]
  match: (e: FestEvent) => boolean
  accent: string
}

export const PLANETS: Planet[] = [
  {
    id: 'sonic',
    name: 'Sonic',
    group: 'Music',
    line: 'The giant. Every set, every stage, every band.',
    kind: 'giant',
    radius: 2100,
    orbit: 9800,
    angle: -2.14,
    height: 1900,
    // MUSIC · electric blue + cyan
    colors: ['#040B2E', '#2446FF', '#7FF0FF'],
    atmosphere: '#3FE0FF',
    ring: { inner: 1.4, outer: 2.35, tilt: 0.42, color: '#9FDBFF' },
    moons: [
      { name: 'Bass', radius: 190, dist: 3600, speed: 0.045, phase: 0.4, incline: 0.2 },
      { name: 'Treble', radius: 110, dist: 4700, speed: -0.03, phase: 2.2, incline: -0.1 },
    ],
    match: (e) => e.category === 'music',
    accent: '#3F7BFF',
  },
  {
    id: 'kinetic',
    name: 'Kinetic',
    group: 'Performance',
    line: 'Dance, theatre, fashion and comedy: bodies in orbit.',
    kind: 'ocean',
    radius: 980,
    orbit: 8600,
    angle: -0.86,
    height: 900,
    // PERFORMANCE · magenta + violet
    colors: ['#14052E', '#6A22D8', '#FF6AD8'],
    atmosphere: '#FF3EC8',
    moons: [{ name: 'Encore', radius: 90, dist: 1700, speed: 0.08, phase: 1.2, incline: 0.3 }],
    match: (e) => ['dance', 'theatre', 'fashion', 'comedy'].includes(e.category),
    accent: '#FF3EC8',
  },
  {
    id: 'canvas',
    name: 'Canvas',
    group: 'Art & Experiences',
    line: 'Murals, installations and the things built into the hall.',
    kind: 'marble',
    radius: 820,
    orbit: 10400,
    angle: -1.42,
    height: -2800,
    // ART · solar orange + violet
    colors: ['#1C0A3A', '#7A5CFF', '#FF9A4D'],
    atmosphere: '#FF8A3D',
    moons: [],
    match: (e) => ['art', 'experiences'].includes(e.category),
    accent: '#FF8A3D',
  },
  {
    id: 'arena',
    name: 'Arena',
    group: 'Competitions',
    line: 'Where things are judged. Cold, bright, fractured with pressure.',
    kind: 'ice',
    radius: 1300,
    orbit: 9300,
    angle: 3.38,
    height: -700,
    // COMPETITIONS · acid green + blue (the one world allowed the rare lime)
    colors: ['#04122E', '#2446FF', '#D8FF7A'],
    atmosphere: '#8FE66A', // the lime lives in the fractures; the air is softer
    ring: { inner: 1.55, outer: 1.75, tilt: -0.3, color: '#E4FF9A' },
    moons: [{ name: 'Verdict', radius: 140, dist: 2400, speed: -0.05, phase: 0.2, incline: -0.25 }],
    match: (e) => e.kind === 'competition',
    accent: '#C6FF3D',
  },
  {
    id: 'forge',
    name: 'Forge',
    group: 'Workshops & Informals',
    line: 'Make something. Break something. Win at pool.',
    kind: 'forge',
    radius: 560,
    orbit: 6200,
    angle: 0.72,
    height: 2300,
    // WORKSHOPS & INFORMALS · amber + indigo: rock and molten seams
    colors: ['#07061A', '#2A2470', '#FFB547'],
    atmosphere: '#FFB547',
    moons: [],
    match: (e) => ['workshops', 'informals'].includes(e.category),
    accent: '#FFB547',
  },
]

/** plain-math position (no three.js here: this module is also used by the DOM layer) */
export const planetPos = (p: Planet): [number, number, number] => [Math.cos(p.angle) * p.orbit, p.height, Math.sin(p.angle) * p.orbit]
export const planetById = (id: string | null | undefined) => PLANETS.find((p) => p.id === id) ?? null
export const planetEvents = (p: Planet) => EVENTS.filter(p.match)

/** Far, dark silhouettes: scale and depth only, never interactive. */
export const SILHOUETTES = [
  { pos: [-60000, 9000, -52000] as const, radius: 9000 },
  { pos: [72000, -16000, -30000] as const, radius: 14000 },
]
