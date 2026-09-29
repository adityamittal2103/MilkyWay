import * as THREE from 'three'
import { CATEGORIES } from '@/data/categories'
import { EVENTS, PROVISIONAL_DAYS, toMinutes } from '@/data/provisional/events'

/**
 * Spatial layouts for the non-venue parts of the world, computed once and shared by the
 * scene (rendering), the director (camera) and the DOM (hit-testing, labels).
 */

/* ─────────── Constellations: event categories on a dome above the hall */
export const DOME = { radius: 380, centre: new THREE.Vector3(0, 0, 0) }

export type SkyConstellation = {
  id: string
  centre: THREE.Vector3
  dir: THREE.Vector3
  stars: THREE.Vector3[]
  edges: [number, number][]
  /** event slug → star position (events bloom around their category's stars) */
  events: { slug: string; pos: THREE.Vector3 }[]
  camera: { pos: [number, number, number]; target: [number, number, number] }
}

const up = new THREE.Vector3(0, 1, 0)
export const SKY: SkyConstellation[] = CATEGORIES.map((c) => {
  const az = THREE.MathUtils.degToRad(c.sky.az)
  const el = THREE.MathUtils.degToRad(c.sky.el)
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize()
  const centre = dir.clone().multiplyScalar(DOME.radius).add(DOME.centre)
  // basis as seen by a viewer at the dome centre looking along `dir`
  const right = new THREE.Vector3().crossVectors(dir, up).normalize()
  const upv = new THREE.Vector3().crossVectors(right, dir).normalize()
  const stars = c.stars.map(([x, y]) => centre.clone().addScaledVector(right, x * c.sky.scale).addScaledVector(upv, y * c.sky.scale))
  const evs = EVENTS.filter((e) => e.category === c.id)
  const events = evs.map((e, i) => {
    const s = stars[(i * 2 + 1) % stars.length]
    const a = i * 2.39996 // golden-angle scatter so siblings never overlap
    const r = c.sky.scale * 0.34
    return {
      slug: e.slug,
      pos: s.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(upv, Math.sin(a) * r).addScaledVector(dir, -8),
    }
  })
  const camPos = dir.clone().multiplyScalar(DOME.radius * 0.36).add(new THREE.Vector3(0, 12, 0))
  return {
    id: c.id,
    centre,
    dir,
    stars,
    edges: c.edges,
    events,
    camera: { pos: camPos.toArray() as [number, number, number], target: centre.toArray() as [number, number, number] },
  }
})
export const skyById = (id: string | null) => SKY.find((s) => s.id === id) ?? null

/* ─────────── Orbits: each festival day is a ring, events ride it by time of day */
export const ORBIT = {
  centre: new THREE.Vector3(0, 150, 0),
  radii: [120, 190, 260],
  tilt: -0.22,
  dayStart: 10 * 60, // 10:00 → angle 0
  daySpan: 14 * 60, // …to 24:00 → full turn
}

export const orbitAngle = (minutes: number) => ((minutes - ORBIT.dayStart) / ORBIT.daySpan) * Math.PI * 2 - Math.PI / 2

export function orbitPoint(day: number, minutes: number, out = new THREE.Vector3()) {
  const r = ORBIT.radii[day % ORBIT.radii.length]
  const a = orbitAngle(minutes)
  out.set(Math.cos(a) * r, 0, Math.sin(a) * r)
  out.applyAxisAngle(new THREE.Vector3(1, 0, 0), ORBIT.tilt)
  return out.add(ORBIT.centre)
}

export const ORBIT_NODES = EVENTS.map((e) => {
  const mid = (toMinutes(e.start) + toMinutes(e.end)) / 2
  return { slug: e.slug, day: e.day, pos: orbitPoint(e.day, mid), start: toMinutes(e.start), end: toMinutes(e.end) }
})
export const ORBIT_DAYS = PROVISIONAL_DAYS.length
