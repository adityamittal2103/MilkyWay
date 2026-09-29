import { VIEWS, blankKey, mixKey, type CamKey } from './universe'

/**
 * Flights: SPACE → YASHOBHOOMI MAIN STAGE is never a teleport.
 *   ship accelerates → camera moves → the building grows → landing → environment settles.
 *
 * A flight is a list of camera keys. Crossing scale levels inserts the station approach as a
 * waypoint (so you always pass Yashobhoomi's silhouette on the way in or out). Segments are
 * weighted by how much actually changes (log-distance zoom + target travel + turn angle), then
 * one global ease-in-out runs across the whole trip, with a small anticipation pull-back.
 */
const SPACE_LEVEL = 3000 // camera distances above this are "space"
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

function segWeight(a: CamKey, b: CamKey) {
  const zoom = Math.abs(Math.log(b.dist / a.dist))
  const travel = a.target.distanceTo(b.target) / Math.max(Math.min(a.dist, b.dist), 1)
  const turn = Math.acos(Math.min(1, Math.max(-1, a.dir.dot(b.dir))))
  return 0.15 + zoom + Math.min(travel, 6) * 0.6 + turn * 0.8
}

export class Flight {
  keys: CamKey[] = []
  cum: number[] = []
  t = 0
  duration = 1
  active = false
  landing = false
  private out = blankKey()

  plan(from: CamKey, to: CamKey, reduced: boolean, via: CamKey[] = []) {
    const clone = (k: CamKey): CamKey => ({ target: k.target.clone(), dir: k.dir.clone(), dist: k.dist, fov: k.fov })
    const keys = [clone(from)]
    const fromSpace = from.dist > SPACE_LEVEL
    const toSpace = to.dist > SPACE_LEVEL
    const toVenue = to.dist < 900
    if (fromSpace && toVenue) keys.push(VIEWS.station, VIEWS.stationNear)
    else if (!fromSpace && from.dist < 900 && toSpace) keys.push(VIEWS.stationNear, VIEWS.station)
    keys.push(...via.map(clone))
    keys.push(clone(to))
    const w = keys.slice(1).map((k, i) => segWeight(keys[i], k))
    const total = w.reduce((a, b) => a + b, 0)
    let acc = 0
    this.cum = [0, ...w.map((x) => (acc += x) / total)]
    this.keys = keys
    this.t = 0
    this.duration = reduced ? 0.35 : Math.min(4.6, Math.max(1.3, 0.9 + total * 0.55))
    this.landing = toVenue && !(from.dist < 900)
    this.active = true
  }

  /** advance; returns the current key (or null when finished) and the speed envelope 0…1 */
  step(dt: number): { key: CamKey; speed: number } | null {
    if (!this.active) return null
    this.t = Math.min(1, this.t + dt / this.duration)
    const g = ease(this.t)
    let i = 0
    while (i < this.cum.length - 2 && g > this.cum[i + 1]) i++
    const local = (g - this.cum[i]) / Math.max(this.cum[i + 1] - this.cum[i], 1e-6)
    mixKey(this.keys[i], this.keys[i + 1], local, this.out)
    // anticipation: a breath backwards before the push
    if (this.t < 0.14) this.out.dist *= 1 + 0.045 * Math.sin((this.t / 0.14) * Math.PI)
    const speed = Math.pow(Math.sin(this.t * Math.PI), 0.8)
    if (this.t >= 1) this.active = false
    return { key: this.out, speed }
  }
}
