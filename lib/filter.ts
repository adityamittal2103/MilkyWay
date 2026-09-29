import { EVENTS, type FestEvent } from '@/data/provisional/events'
import { CATEGORIES } from '@/data/categories'
import { ZONES } from '@/data/zones'
import { PLANETS } from '@/data/planets'

/**
 * One filter, many worlds. The active filter is global (store.filter) and every layer reads the
 * same derived result: event markers, sector heat, constellations, planets, schedule orbit,
 * the radar and the suggested destination.
 *
 * Two rings on the dial: the inner ring filters by what kind of thing it is; the outer ring by
 * discipline. FOOD is zone-based because food has sectors, not events.
 */
export type FilterDef = { id: string; label: string; ring: 0 | 1 | 2; accent: string; match?: (e: FestEvent) => boolean; zones?: string[] }

const PERFORMANCE = ['dance', 'theatre', 'fashion', 'comedy']

export const FILTERS: FilterDef[] = [
  { id: 'all', label: 'All', ring: 0, accent: '#F1EDE4' },
  { id: 'competitions', label: 'Competitions', ring: 1, accent: '#C6FF3D', match: (e) => e.kind === 'competition' },
  { id: 'performances', label: 'Performances', ring: 1, accent: '#FF3EC8', match: (e) => e.kind === 'show' || PERFORMANCE.includes(e.category) },
  { id: 'workshop', label: 'Workshops', ring: 1, accent: '#3FE0FF', match: (e) => e.kind === 'workshop' },
  { id: 'food', label: 'Food', ring: 1, accent: '#FFB547', zones: ['orbital-market', 'refuel-deck', 'outer-orbit'] },
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.name, ring: 2 as const, accent: c.accent, match: (e: FestEvent) => e.category === c.id })),
]

export const filterById = (id: string | null | undefined) => FILTERS.find((f) => f.id === id) ?? FILTERS[0]

export type FilterResult = {
  def: FilterDef
  events: Set<string>
  zoneCount: Map<string, number>
  zoneHeat: number[] // aligned with ZONES, 0…1
  categories: Set<string>
  planets: Set<string>
  suggested: string | null // zone id with the most matches
  total: number
}

const cache = new Map<string, FilterResult>()

export function applyFilter(id: string | null | undefined): FilterResult {
  const def = filterById(id)
  const hit = cache.get(def.id)
  if (hit) return hit
  const all = def.id === 'all'
  const evs = all ? EVENTS : def.match ? EVENTS.filter(def.match) : []
  const zoneCount = new Map<string, number>()
  for (const e of evs) zoneCount.set(e.zone, (zoneCount.get(e.zone) ?? 0) + 1)
  if (def.zones) for (const z of def.zones) zoneCount.set(z, Math.max(1, zoneCount.get(z) ?? 0))
  const max = Math.max(1, ...zoneCount.values())
  const zoneHeat = ZONES.map((z) => (all ? 0.55 : (zoneCount.get(z.id) ?? 0) / max))
  const categories = new Set(evs.map((e) => e.category))
  const planets = new Set(PLANETS.filter((p) => evs.some(p.match)).map((p) => p.id))
  let suggested: string | null = null
  if (!all) {
    let best = 0
    for (const [z, n] of zoneCount) if (n > best) (best = n), (suggested = z)
  }
  const r: FilterResult = { def, events: new Set(evs.map((e) => e.slug)), zoneCount, zoneHeat, categories, planets, suggested, total: def.zones && !def.match ? def.zones.length : evs.length }
  cache.set(def.id, r)
  return r
}
