import * as THREE from 'three'
import type { Mode, NavTarget } from './store'
import { ZONES, zoneById } from '@/data/zones'
import { planetById } from '@/data/planets'
import { EVENTS } from '@/data/provisional/events'
import { skyById } from './sky'
import { VIEWS, TRANSMISSION_VIEW, key, mixKey, blankKey, planetPosition, type CamKey } from './universe'
import { applyFilter } from './filter'
import { JOURNEY_UNITS, exploreIndex, EVENT_XZ } from './journey'
export { JOURNEY_UNITS, CHAPTER_UNITS, exploreIndex, journeyShip, EVENT_XZ } from './journey'

/**
 * THE DIRECTOR: a pure function from (route, scroll, navigation, filter) → what the world should
 * look like. 3D components damp their own uniforms toward these targets, so all choreography
 * lives here. Camera states: SPACE · GALAXY · APPROACH · ORBIT · LANDING · VENUE · ZONE · EVENT.
 */

export type Targets = {
  cam: CamKey
  /** identifies the destination; a change triggers a planned flight instead of a jump */
  camId: string
  /** home journey drives the camera directly from scroll (no flights) */
  scrubbed: boolean
  galaxy: number // the big galaxy's visibility
  cloud: number // the station's accretion cloud
  morph: number // cloud → venue surface particles
  reveal: number // venue architecture drawn in
  lights: number // bulbs + floor sectors on
  markers: number // zone labels + event markers
  sky: number // category constellations over the hall
  sectionSky: number // discoverable section constellations in the far sky
  orbits: number // mission-timeline rings
  dock: number
  dim: number
  dust: number // near-field motes
  hyper: number // hyperspace boost
  planetLabels: number
  zoneLight: number[]
  focusZone: number
  userControl: boolean // drag/zoom/keys allowed
  /** optional waypoints for the next planned flight (e.g. through a constellation) */
  via?: CamKey[]
}

const ramp = (p: number, a: number, b: number) => {
  const t = Math.min(1, Math.max(0, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const bump = (p: number, a: number, b: number) => Math.sin(Math.min(1, Math.max(0, (p - a) / (b - a))) * Math.PI)

const KEYS: { u: number; k: CamKey }[] = [
  { u: 0, k: VIEWS.void },
  { u: 1, k: VIEWS.galaxy },
  { u: 2, k: VIEWS.milkyway },
  { u: 3, k: VIEWS.approach },
  { u: 4.5, k: VIEWS.station },
  { u: 5.25, k: VIEWS.stationNear },
  { u: 6, k: VIEWS.landing },
  { u: 7, k: VIEWS.inside },
  { u: 8, k: VIEWS.inside2 },
  { u: 9, k: VIEWS.system },
]
const tmpKey = blankKey()

/** camera for a journey position (in units), eased inside each segment so chapters settle */
export function journeyKey(u: number, out: CamKey = tmpKey): CamKey {
  let i = 0
  while (i < KEYS.length - 2 && u > KEYS[i + 1].u) i++
  const a = KEYS[i]
  const b = KEYS[i + 1]
  const raw = Math.min(1, Math.max(0, (u - a.u) / (b.u - a.u)))
  return mixKey(a.k, b.k, ramp(raw, 0.08, 0.94), out)
}

/* ─────────── navigable cameras (explore + venue) */
/** each event's marker position on the hall floor, inside its sector */
export const EVENT_ANCHORS = new Map([...EVENT_XZ].map(([k, v]) => [k, new THREE.Vector3(v.x, 0, v.z)]))

export function navKey(n: NavTarget, mobile: boolean): { k: CamKey; id: string } {
  switch (n.kind) {
    case 'space':
      return { k: VIEWS.galaxy, id: 'space' }
    case 'galaxy':
      return { k: VIEWS.milkyway, id: 'galaxy' }
    case 'system':
      return { k: mobile ? key([1600, 1400, 3400], [0, 0, 0], 50) : VIEWS.system, id: 'system' }
    case 'planet': {
      const p = planetById(n.id)
      if (!p) return navKey({ kind: 'system' }, mobile)
      const c = planetPosition(p)
      // seen from the station side, slightly above, the planet filling ~40% of the frame
      const from = c.clone().multiplyScalar(-1).normalize()
      const pos = c.clone().addScaledVector(from, p.radius * (mobile ? 5.4 : 3.9)).add(new THREE.Vector3(0, p.radius * 0.9, 0))
      return { k: key(pos, c, 44), id: `planet:${p.id}` }
    }
    case 'venue':
      return { k: mobile ? key([0, 560, 190], [0, 0, -4], 48) : VIEWS.venue, id: 'venue' }
    case 'zone': {
      const z = zoneById(n.id)
      if (!z) return navKey({ kind: 'venue' }, mobile)
      const m = mobile ? 1.35 : 1
      const pos: [number, number, number] = [z.centre[0] + (z.camera.pos[0] - z.centre[0]) * m, z.camera.pos[1] * m, z.centre[2] + (z.camera.pos[2] - z.centre[2]) * m]
      return { k: key(pos, z.camera.target, 42), id: `zone:${z.id}` }
    }
    case 'event': {
      const a = EVENT_ANCHORS.get(n.id)
      if (!a) return navKey({ kind: 'venue' }, mobile)
      const d = mobile ? 1.4 : 1
      return { k: key([a.x + 34 * d, 42 * d, a.z + 70 * d], [a.x, 12, a.z], 44), id: `event:${n.id}` }
    }
  }
}

const zonesAll = (v: number) => ZONES.map(() => v)

export function direct(s: {
  mode: Mode
  journey: number
  introDone: boolean
  nav: NavTarget
  selectedZone: string | null
  hoveredZone: string | null
  selectedCategory: string | null
  selectedEvent: string | null
  filter: string
  mobile: boolean
  transmission?: string | null
}): Targets {
  const f = applyFilter(s.filter)
  const filtered = f.def.id !== 'all'
  const hover = ZONES.findIndex((z) => z.id === (s.hoveredZone ?? s.selectedZone))
  // filter heat → base sector light: matches glow, the rest stays readable for orientation
  const heatLight = ZONES.map((_, i) => (filtered ? 0.12 + 0.88 * f.zoneHeat[i] : 1))
  const base: Targets = {
    cam: VIEWS.page,
    camId: 'page',
    scrubbed: false,
    galaxy: 1,
    cloud: 0,
    morph: 1,
    reveal: 1,
    lights: 1,
    markers: 0,
    sky: 0,
    sectionSky: 0,
    orbits: 0,
    dock: 0,
    dim: 0,
    dust: 0.4,
    hyper: 0,
    planetLabels: 0,
    zoneLight: heatLight,
    focusZone: hover,
    userControl: false,
  }

  switch (s.mode) {
    case 'home': {
      if (!s.introDone) {
        return { ...base, cam: VIEWS.void, camId: 'void', scrubbed: true, galaxy: 0, morph: 0, reveal: 0, lights: 0, dust: 1, zoneLight: zonesAll(0), focusZone: -1 }
      }
      const u = s.journey * JOURNEY_UNITS
      const walk = exploreIndex(u)
      return {
        ...base,
        cam: journeyKey(u),
        camId: 'journey',
        scrubbed: true,
        galaxy: ramp(u, 0.3, 1.0),
        cloud: ramp(u, 2.9, 3.7),
        morph: ramp(u, 4.35, 5.2),
        reveal: ramp(u, 5.0, 5.85),
        lights: ramp(u, 5.55, 6.05),
        markers: ramp(u, 5.8, 6.3),
        sky: ramp(u, 7.5, 8.1) * (1 - ramp(u, 8.55, 8.95)),
        sectionSky: ramp(u, 8.4, 9),
        dust: 1 - 0.65 * ramp(u, 5.6, 6.2),
        hyper: bump(u, 2.35, 3.45),
        planetLabels: ramp(u, 3.1, 3.5) * (1 - ramp(u, 4.3, 4.7)),
        zoneLight: ZONES.map((_, i) => ramp(u, 6.5 + i * 0.06, 6.7 + i * 0.06) * heatLight[i]),
        focusZone: hover >= 0 ? hover : walk,
      }
    }
    case 'explore':
    case 'venue': {
      // the venue page drives the same camera from its own selection state
      const n: NavTarget =
        s.mode === 'venue'
          ? s.selectedEvent
            ? { kind: 'event', id: s.selectedEvent }
            : s.selectedZone
              ? { kind: 'zone', id: s.selectedZone }
              : { kind: 'venue' }
          : s.nav
      const { k, id } = navKey(n, s.mobile)
      const inVenue = n.kind === 'venue' || n.kind === 'zone' || n.kind === 'event'
      const focus = n.kind === 'zone' ? ZONES.findIndex((z) => z.id === n.id) : -1
      return {
        ...base,
        cam: k,
        camId: id,
        markers: inVenue ? 1 : 0,
        dust: inVenue ? 0.3 : 1,
        cloud: inVenue ? 0 : 0.35,
        planetLabels: n.kind === 'system' || n.kind === 'planet' ? 1 : 0,
        sectionSky: inVenue ? 0.35 : 1,
        focusZone: hover >= 0 ? hover : focus,
        userControl: true,
      }
    }
    case 'events':
    case 'competitions': {
      // an event page: travel through its constellation, then down to its pin in the hall
      if (s.selectedEvent) {
        const e = EVENTS.find((x) => x.slug === s.selectedEvent)
        const sk = skyById(e?.category ?? null)
        const { k, id } = navKey({ kind: 'event', id: s.selectedEvent }, s.mobile)
        const pin: CamKey = { ...k, target: k.target.clone(), dir: k.dir.clone(), dist: k.dist * 1.25 }
        return { ...base, cam: pin, camId: `detail:${id}`, via: sk ? [key(sk.camera.pos, sk.camera.target, 44)] : undefined, markers: 1, sky: 0.6, dim: 0.1 }
      }
      const sk = skyById(s.selectedCategory)
      const k = sk ? key(sk.camera.pos, sk.camera.target, 44) : s.mobile ? key([0, 40, 560], [0, 200, 0], 56) : VIEWS.events
      return { ...base, cam: k, camId: sk ? `sky:${sk.id}` : 'events', sky: 1, lights: 0.55, dim: 0.15, markers: 0.35, zoneLight: ZONES.map((_, i) => 0.35 * heatLight[i]) }
    }
    case 'schedule':
      return {
        ...base,
        cam: s.mobile ? key([0, 760, 520], [0, 150, 0], 48) : VIEWS.timeline,
        camId: 'timeline',
        orbits: 1,
        lights: 0.5,
        dim: 0.1,
        zoneLight: ZONES.map((_, i) => (s.selectedZone ? (ZONES[i].id === s.selectedZone ? 1 : 0.15) : 0.3 * heatLight[i])),
        focusZone: s.selectedZone ? ZONES.findIndex((z) => z.id === s.selectedZone) : -1,
      }
    case 'artists':
      // a transmission turns the camera away from the galaxy into dark space: the signal is the subject
      if (s.transmission)
        return { ...base, cam: TRANSMISSION_VIEW, camId: `tx:${s.transmission}`, galaxy: 0.35, morph: 0, reveal: 0, lights: 0, cloud: 0, zoneLight: zonesAll(0), dim: 0.3, dust: 0.7 }
      // the signal network: the galaxy is backdrop here, never brighter than the nodes' type
      return { ...base, cam: VIEWS.milkyway, camId: 'artists', galaxy: 0.5, morph: 0, reveal: 0, lights: 0, cloud: 1, zoneLight: zonesAll(0), dim: 0.4, dust: 1 }
    case 'register':
      return { ...base, cam: VIEWS.board, camId: 'board', dock: 1, dim: 0.1, focusZone: 0 }
    case 'page':
    default:
      return { ...base, cam: VIEWS.page, camId: 'page', morph: 0, reveal: 0, lights: 0, cloud: 1, zoneLight: zonesAll(0), dim: 0.35, focusZone: -1, dust: 1 }
  }
}
