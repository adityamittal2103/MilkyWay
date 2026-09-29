import * as THREE from 'three'
import { planetPos, type Planet } from '@/data/planets'

/**
 * THE UNIVERSE LAYOUT. One place that decides where everything is, and why.
 *
 *   UNIVERSE → GALAXY → ORBIT (the Yashobhoomi system) → PLANETS → YASHOBHOOMI → SECTORS → EVENTS
 *
 * Scale: 1 unit ≈ the venue model ×100 (the hall is ~434 × 150 units, walls 14 high).
 * The galaxy is a barred spiral of radius 42,000. Yashobhoomi sits on an outer arm
 * at 56% of the radius, which is roughly where the Sun sits in the real Milky Way. So from the
 * venue you look up at the galactic band, and from deep space the festival is one bright point
 * on an arm.
 */

/* ───────────────────────── galaxy frame */
export const GALAXY_R = 42000
export const GALAXY_BAR = 9500
export const GALAXY_PITCH = Math.tan((13 * Math.PI) / 180) // Milky Way arm pitch ≈ 12–14°
export const GALAXY_BAR_ANGLE = 0.42
export const GALAXY_R0 = GALAXY_BAR * 0.92
/** local polar position of the station on arm 0 */
export const STATION_R = GALAXY_R * 0.56
export const STATION_THETA = GALAXY_BAR_ANGLE + Math.log(STATION_R / GALAXY_R0) / GALAXY_PITCH

/** galaxy plane is tilted against the hall floor so the band arcs across the venue's sky */
export const GALAXY_NORMAL = new THREE.Vector3(0.36, 1, 0.22).normalize()
export const GALAXY_QUAT = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), GALAXY_NORMAL)
const stationLocal = new THREE.Vector3(Math.cos(STATION_THETA) * STATION_R, 0, Math.sin(STATION_THETA) * STATION_R)
/** galaxy centre in world space, chosen so the station lands exactly at the origin */
export const GALAXY_CENTRE = stationLocal.clone().applyQuaternion(GALAXY_QUAT).multiplyScalar(-1)
/** unit vector from the galactic centre to the station, in world space */
export const TO_STATION = GALAXY_CENTRE.clone().multiplyScalar(-1).normalize()

/* ───────────────────────── the sun of this system (a distant star that lights the planets) */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.42, -0.72).normalize()

/* ───────────────────────── the Yashobhoomi station */
export const STATION = {
  platform: { minX: -236, maxX: 246, minZ: -170, maxZ: 112, depth: 34 },
  rings: [
    { r: 360, tilt: [0.18, 0, 0.08] as const, speed: 0.05 },
    { r: 470, tilt: [-0.12, 0.6, -0.16] as const, speed: -0.03 },
    { r: 610, tilt: [0.42, 1.3, 0.1] as const, speed: 0.018 },
  ],
}

/**
 * The platform outline (rounded rect in XZ). Shared by the deck surface and the hull so the two
 * meet at one edge instead of overlapping (overlapping faces z-fight from orbit).
 * Shape y = world −z, so a ShapeGeometry rotated by −90° about X lands face-up on the deck.
 */
export function platformShape(inflate = 0, r = 26) {
  const p = STATION.platform
  const [x0, x1, z0, z1] = [p.minX - inflate, p.maxX + inflate, -p.maxZ - inflate, -p.minZ + inflate]
  const s = new THREE.Shape()
  s.moveTo(x0 + r, z0)
  s.lineTo(x1 - r, z0)
  s.quadraticCurveTo(x1, z0, x1, z0 + r)
  s.lineTo(x1, z1 - r)
  s.quadraticCurveTo(x1, z1, x1 - r, z1)
  s.lineTo(x0 + r, z1)
  s.quadraticCurveTo(x0, z1, x0, z1 - r)
  s.lineTo(x0, z0 + r)
  s.quadraticCurveTo(x0, z0, x0 + r, z0)
  return s
}
export const DECK_Y = -0.05

/* ───────────────────────── camera keyframes (log-distance interpolation) */
export type CamKey = { target: THREE.Vector3; dir: THREE.Vector3; dist: number; fov: number }

export const key = (pos: [number, number, number] | THREE.Vector3, target: [number, number, number] | THREE.Vector3, fov = 42): CamKey => {
  const p = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone()
  const t = Array.isArray(target) ? new THREE.Vector3(...target) : target.clone()
  const d = p.clone().sub(t)
  const dist = Math.max(d.length(), 1e-3)
  return { target: t, dir: d.divideScalar(dist), dist, fov }
}

/**
 * Interpolate two camera keys. Targets lerp, directions slerp, distance interpolates
 * geometrically, so zooming from 80,000 units to 400 feels like constant speed and the camera
 * never cuts straight through the galaxy.
 */
export function mixKey(a: CamKey, b: CamKey, t: number, out: CamKey): CamKey {
  out.target.lerpVectors(a.target, b.target, t)
  out.dir.copy(a.dir).lerp(b.dir, t)
  if (out.dir.lengthSq() < 1e-6) out.dir.copy(b.dir)
  out.dir.normalize()
  out.dist = Math.exp(Math.log(a.dist) + (Math.log(b.dist) - Math.log(a.dist)) * t)
  out.fov = a.fov + (b.fov - a.fov) * t
  return out
}
export const blankKey = (): CamKey => ({ target: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), dist: 1, fov: 42 })
export const keyPos = (k: CamKey, out = new THREE.Vector3()) => out.copy(k.target).addScaledVector(k.dir, k.dist)

/* ───────────────────────── landmark cameras */
const G = GALAXY_CENTRE
const N = GALAXY_NORMAL
// an in-plane axis perpendicular to the station direction
const W = new THREE.Vector3().crossVectors(N, TO_STATION).normalize()

export const VIEWS = {
  /** deep space: far above the galactic plane, looking away into the dark */
  void: key(
    G.clone().addScaledVector(N, 96000).addScaledVector(W, 30000),
    G.clone().addScaledVector(N, 98000).addScaledVector(W, 45000).addScaledVector(TO_STATION, 9000),
    40,
  ),
  /** the galaxy revealed, whole */
  galaxy: key(G.clone().addScaledVector(N, 88000).addScaledVector(W, 26000).addScaledVector(TO_STATION, -9000), G, 44),
  /** THE MILKY WAY: closer, dramatic, the arm with the station swinging through frame */
  milkyway: key(G.clone().addScaledVector(N, 36000).addScaledVector(TO_STATION, -30000).addScaledVector(W, -12000), G.clone().addScaledVector(TO_STATION, 12000), 50),
  /** approach: dropping onto the outer arm, the system ahead */
  approach: key(new THREE.Vector3(0, 0, 0).addScaledVector(N, 7000).addScaledVector(TO_STATION, -9000).addScaledVector(W, 3000), new THREE.Vector3(0, 0, 0), 46),
  /** the station seen whole, as an abstract structure */
  station: key([-900, 520, 1350], [0, 0, -20], 40),
  /** close enough to read the architecture */
  stationNear: key([-320, 250, 520], [0, 0, -10], 40),
  /** landing: low, inside the walls */
  landing: key([-150, 44, 150], [-40, 8, -20], 48),
  /** the universe inside: above the hall, sky visible */
  inside: key([-260, 170, 230], [-60, 0, -10], 44),
  inside2: key([230, 160, 220], [70, 0, -10], 44),
  /** explore: the system from orbit, planets and galactic band behind */
  system: key([1400, 900, 2300], [0, 0, 0], 44),
  venue: key([0, 330, 300], [0, 0, -5], 40),
  events: key([0, 30, 140], [0, 190, -220], 50),
  timeline: key([0, 520, 380], [0, 150, 0], 40),
  board: key([-96, 58, -190], [-176, 4, -84], 44),
  page: key([-1600, 900, 2600], [0, 0, 0], 38),
}
/** an artist transmission: deep space, facing directly away from the sun, so the signal is the only light */
export const TRANSMISSION_VIEW: CamKey = (() => {
  const P = keyPos(VIEWS.void)
  const away = SUN_DIR.clone().negate().add(new THREE.Vector3(0, -0.18, 0)).normalize()
  return key(P, P.clone().addScaledVector(away, 4000), 40)
})()

/** world-space planet centre as a vector (world code only) */
export const planetPosition = (p: Planet, out = new THREE.Vector3()) => out.set(...planetPos(p))
