import { rectFromModel, fromModel } from '@/lib/constants'

/**
 * VENUE SECTORS. Geometry is taken from the supplied Blender floor plan
 * (rects are Blender-space [x0, y0, x1, y1]; see docs/VENUE-PIPELINE.md for the evidence per area).
 *
 * `use` is PROVISIONAL: inferred from what the model contains (arches, stage platform,
 * bar counter…). Replace with the organisers' confirmed allocation.
 */
export type ZoneGlyph = { ring: boolean; arcs: number; ticks: number; dot: 'center' | 'orbit' | 'none'; rot: number }
export type Zone = {
  id: string
  code: string
  name: string
  subtitle: string
  use: string
  description: string
  evidence: string
  model: [number, number, number, number]
  rect: [number, number, number, number]
  centre: [number, number, number]
  camera: { pos: [number, number, number]; target: [number, number, number] }
  accent: string
  glyph: ZoneGlyph
  provisional: true
}

type ZoneSeed = Omit<Zone, 'rect' | 'centre' | 'camera' | 'provisional' | 'code'> & { lift?: number }

const seeds: ZoneSeed[] = [
  {
    id: 'docking-bay',
    name: 'Docking Bay',
    subtitle: 'Arrivals & boarding',
    use: 'Entry · help desk · pass collection',
    description: 'Where every flight begins. The gate cuts clean through the north wall of the hall.',
    evidence: 'Gate structure crossing the north wall, walled west room, queue barricade',
    model: [-2.02, -0.85, -1.62, 0.56],
    accent: '#FF7A1A',
    glyph: { ring: true, arcs: 1, ticks: 4, dot: 'center', rot: 0 },
  },
  {
    id: 'wormhole',
    name: 'The Wormhole',
    subtitle: 'Arch tunnel',
    use: 'Arrival installation',
    description: 'A run of light arches. Walk through and the festival starts behind you.',
    evidence: 'Row of lit arches (Light 4 bases) in the west wing',
    model: [-1.62, -0.85, -1.27, 0.2],
    accent: '#3FE0FF',
    glyph: { ring: false, arcs: 3, ticks: 0, dot: 'center', rot: 0.4 },
  },
  {
    id: 'nebula-walk',
    name: 'Nebula Walk',
    subtitle: 'Light curtain',
    use: 'Art & photo walk',
    description: 'Two thousand bulbs hang along the north wall. Stand in front of them and you are the constellation.',
    evidence: '2,227 bulbs forming a curtain along the north wall',
    model: [-1.62, 0.2, -0.6, 0.56],
    accent: '#FF3EC8',
    glyph: { ring: true, arcs: 0, ticks: 12, dot: 'none', rot: 0 },
  },
  {
    id: 'event-horizon',
    name: 'Event Horizon',
    subtitle: 'Gallery corridor',
    use: 'Exhibitions · workshops',
    description: 'A folded corridor. What goes in comes out changed.',
    evidence: 'U-shaped partitioned corridor with an inner room',
    model: [-1.27, -0.85, -0.95, 0.2],
    accent: '#7A5CFF',
    glyph: { ring: true, arcs: 2, ticks: 0, dot: 'orbit', rot: 1.2 },
  },
  {
    id: 'constellation-hall',
    name: 'Constellation Hall',
    subtitle: 'Competition arena',
    use: 'Competitions · judged events',
    description: 'A walled room of angled plinths facing a banner dais. Built for being judged.',
    evidence: 'Enclosed central room: five angled plinths, banner on a low dais, 2×10 display grid',
    model: [-0.6, -0.2, 0.73, 0.33],
    accent: '#3F7BFF',
    glyph: { ring: false, arcs: 0, ticks: 5, dot: 'orbit', rot: 0.3 },
  },
  {
    id: 'supergiant',
    name: 'Supergiant',
    subtitle: 'Main stage',
    use: 'Headline performances · concerts',
    description: 'The brightest object in the hall. Speaker stacks, ring rigs and the long platform on the south wall.',
    evidence: 'South platform floor-mark, four ring rigs, DJ console cluster, speaker stacks, audience chair row',
    model: [-0.6, -0.87, 0.72, -0.4],
    accent: '#FF4F9A',
    glyph: { ring: true, arcs: 0, ticks: 8, dot: 'center', rot: 0 },
  },
  {
    id: 'zero-g',
    name: 'Zero-G Lounge',
    subtitle: 'Games & informals',
    use: 'Informals · games · café tables',
    description: 'Pool table, a cabinet in the corner, round tables. Gravity optional.',
    evidence: 'Pool table (green fabric), arcade-like cabinet, seven round café tables',
    model: [0.76, -0.86, 1.4, 0.55],
    accent: '#A14DFF',
    glyph: { ring: false, arcs: 2, ticks: 3, dot: 'center', rot: 2.1 },
  },
  {
    id: 'orbital-market',
    name: 'Orbital Market',
    subtitle: 'Bar & bites',
    use: 'Food & drinks',
    description: 'An angled counter, four stools, shelves of glass. Refuel between sets.',
    evidence: 'Angled bar counter, four bar stools, bottle shelves, vending machine',
    model: [1.39, -0.08, 2.23, 0.57],
    accent: '#FFB547',
    glyph: { ring: true, arcs: 1, ticks: 6, dot: 'orbit', rot: 0.8 },
  },
  {
    id: 'refuel-deck',
    name: 'Refuel Deck',
    subtitle: 'Food court',
    use: 'Food stalls',
    description: 'A U-shaped counter wrapped around the south-east corner.',
    evidence: 'U-shaped counter with serving points in the south-east corner',
    model: [1.43, -0.86, 2.23, -0.08],
    accent: '#FF8A3D',
    glyph: { ring: false, arcs: 1, ticks: 0, dot: 'center', rot: 3.1 },
  },
  {
    id: 'outer-orbit',
    name: 'Outer Orbit',
    subtitle: 'Outside the hall',
    use: 'Outdoor kiosk · food truck',
    description: 'Beyond the north wall: a tall kiosk and a red truck parked in orbit.',
    evidence: 'Tall kiosk structure and a red vehicle outside the north wall',
    model: [-0.2, 1.2, 2.0, 1.5],
    accent: '#6C7BFF',
    glyph: { ring: true, arcs: 0, ticks: 0, dot: 'orbit', rot: 0 },
    lift: 1.4,
  },
]

export const ZONES: Zone[] = seeds.map((s, i) => {
  const rect = rectFromModel(s.model)
  const cx = (rect[0] + rect[2]) / 2
  const cz = (rect[1] + rect[3]) / 2
  const span = Math.max(rect[2] - rect[0], rect[3] - rect[1])
  const d = Math.max(90, span * 1.25) * (s.lift ?? 1)
  return {
    ...s,
    code: `S-${String(i + 1).padStart(2, '0')}`,
    rect,
    centre: [cx, 0, cz],
    camera: { pos: [cx + d * 0.18, d * 0.78, cz + d * 0.72], target: [cx, 4, cz] },
    provisional: true,
  }
})

export const zoneById = (id: string | null | undefined) => ZONES.find((z) => z.id === id) ?? null

/** Hit-test a floor point (world x/z) against sector rects. */
export const zoneAt = (x: number, z: number) =>
  ZONES.find((zn) => x >= zn.rect[0] && x <= zn.rect[2] && z >= zn.rect[1] && z <= zn.rect[3]) ?? null

/** The entrance gate: where boarding happens. */
export const GATE = fromModel(-1.71, 0.56, 0)
