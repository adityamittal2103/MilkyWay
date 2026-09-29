/**
 * Central tuning file. Colours, world coordinates, camera presets, motion timings,
 * particle budgets. If a visual value needs tweaking, it should live here.
 */

/* ───────────────────────── palette (mirrors styles/tokens.css) */
export const COLOR = {
  void: '#02030A',
  abyss: '#050817',
  ink: '#0B1024',
  violet: '#7A5CFF',
  uv: '#A14DFF',
  deep: '#2446FF',
  cyan: '#3FE0FF',
  magenta: '#FF3EC8',
  warm: '#FFF4E0',
  starlight: '#F1EDE4',
  dust: '#8B90A6',
  ion: '#5B8CFF',
  pulsar: '#FF3E9A',
  flare: '#FF7A1A',
  lumen: '#CFE0FF',
} as const

/* ───────────────────────── world space
 * The venue comes from `Map Nothing.blend` (Z-up diorama units). The pipeline maps
 *   web = ((x - 0.10) * 100, z * 100, -(y + 0.15) * 100)
 * so the hall floor sits on y = 0, north is -Z, and the hall is ~430 × 150 units.
 * `fromModel` lets content configs stay traceable to Blender coordinates.
 */
export const MODEL = { scale: 100, cx: 0.1, cy: -0.15 } as const
export const fromModel = (x: number, y: number, z = 0): [number, number, number] => [
  (x - MODEL.cx) * MODEL.scale,
  z * MODEL.scale,
  -(y - MODEL.cy) * MODEL.scale,
]
/** Model-space rect [x0, y0, x1, y1] → world-space rect [minX, minZ, maxX, maxZ] */
export const rectFromModel = (r: [number, number, number, number]): [number, number, number, number] => {
  const a = fromModel(r[0], r[1])
  const b = fromModel(r[2], r[3])
  return [Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2])]
}

export const HALL = {
  min: [-212.3, -78.8] as const, // floor slab (x, z)
  max: [222.2, 71.0] as const,
  wallHeight: 13.9,
}

/* The universe layout (galaxy frame, planets, station, landmark cameras) lives in lib/universe.ts.
 * Camera motion is planned in lib/flight.ts; choreography in lib/director.ts. */

/* ───────────────────────── quality tiers
 * Everything that costs GPU time has a budget per tier. PerformanceMonitor steps down one tier
 * at a time, but only after the warm-up window (see WorldCanvas).
 */
export type Tier = 'low' | 'medium' | 'high' | 'ultra'
export type QualityProfile = {
  dpr: [number, number]
  particles: number // station cloud → venue morph
  galaxy: number // galaxy stars
  stars: number // near streak stars
  dust: number // near-field motes
  nebulae: number // procedural nebula billboards
  nebulaOctaves: number
  debris: number
  planetDetail: number // icosphere subdivisions
  post: 'none' | 'lite' | 'full'
  antialias: boolean
}
export const QUALITY: Record<Tier, QualityProfile> = {
  low: { dpr: [1, 1], particles: 14000, galaxy: 36000, stars: 1400, dust: 260, nebulae: 3, nebulaOctaves: 2, debris: 40, planetDetail: 3, post: 'none', antialias: false },
  medium: { dpr: [1, 1.5], particles: 30000, galaxy: 80000, stars: 3200, dust: 520, nebulae: 6, nebulaOctaves: 3, debris: 90, planetDetail: 4, post: 'lite', antialias: true },
  high: { dpr: [1, 2], particles: 50000, galaxy: 150000, stars: 6000, dust: 900, nebulae: 9, nebulaOctaves: 4, debris: 160, planetDetail: 5, post: 'full', antialias: true },
  ultra: { dpr: [1, 2], particles: 60000, galaxy: 240000, stars: 9000, dust: 1400, nebulae: 12, nebulaOctaves: 5, debris: 260, planetDetail: 6, post: 'full', antialias: true },
}
export const TIER_DOWN: Record<Tier, Tier> = { ultra: 'high', high: 'medium', medium: 'low', low: 'low' }

export const BREAKPOINT = { mobile: 720, tablet: 1080 }
