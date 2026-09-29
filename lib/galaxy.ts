import { GALAXY_R, GALAXY_BAR, GALAXY_BAR_ANGLE, GALAXY_PITCH, GALAXY_R0 } from './universe'

/**
 * Procedural Milky Way: the real morphology, not a generic swirl.
 * Central bar, two major arms leaving the bar ends (Scutum–Centaurus, Perseus), two fainter
 * minor arms, a thick bulge, a diffuse disc, globular clusters in the halo, pink HII knots
 * and dark dust lanes hugging the inner edge of the arms.
 * Everything is in the galaxy's LOCAL frame (disc in XZ); the scene rotates it into place.
 * Deterministic (seeded), so every visit and every quality tier sees the same galaxy.
 */
export function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const gaussFrom = (rnd: () => number) => () => {
  let u = 0
  let v = 0
  while (u === 0) u = rnd()
  while (v === 0) v = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** position on arm `arm` at fractional radius t (0 = bar end, 1 = rim) */
export function armPoint(arm: number, t: number) {
  const off = GALAXY_BAR_ANGLE + arm * Math.PI + (arm >= 2 ? Math.PI / 2 : 0)
  const r = GALAXY_R0 + t * (GALAXY_R - GALAXY_R0)
  const th = off + Math.log(r / GALAXY_R0) / GALAXY_PITCH
  return { r, th, x: Math.cos(th) * r, z: Math.sin(th) * r }
}

export type GalaxyStars = { pos: Float32Array; col: Float32Array; size: Float32Array; seed: Float32Array }

export function makeGalaxyStars(n: number, seed = 1977): GalaxyStars {
  const rnd = mulberry32(seed)
  const gauss = gaussFrom(rnd)
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const size = new Float32Array(n)
  const sd = new Float32Array(n)
  const R = GALAXY_R
  const H = R * 0.028
  // colour with intent: a gold core, arms running violet (inner) → cyan (outer), magenta
  // star-forming knots, a deep indigo disc. Structure (the seeded sequence) is unchanged.
  const core = [1.0, 0.78, 0.5]
  const white = [0.88, 0.9, 1.0]
  const violet = [0.62, 0.48, 1.0]
  const cyan = [0.38, 0.86, 1.0]
  const pink = [1.0, 0.3, 0.78]
  const dust = [0.3, 0.3, 0.78]
  const armCol = [0, 0, 0]
  const clusters = Array.from({ length: 14 }, () => {
    const th = rnd() * Math.PI * 2
    const ph = Math.acos(2 * rnd() - 1)
    const rr = R * (0.25 + rnd() * 0.55)
    return [rr * Math.sin(ph) * Math.cos(th), rr * Math.cos(ph) * 0.6, rr * Math.sin(ph) * Math.sin(th)]
  })

  for (let i = 0; i < n; i++) {
    const r = rnd()
    let x = 0
    let y = 0
    let z = 0
    let c = white
    let s = 1
    if (r < 0.13) {
      // bulge: warm, dense, slightly flattened
      const rr = Math.abs(gauss()) * R * 0.09
      const th = rnd() * Math.PI * 2
      const ph = Math.acos(2 * rnd() - 1)
      x = rr * Math.sin(ph) * Math.cos(th)
      z = rr * Math.sin(ph) * Math.sin(th)
      y = rr * Math.cos(ph) * 0.55
      c = core
      s = 1.4 + rnd() * 1.6
    } else if (r < 0.23) {
      // the bar
      const t = (rnd() * 2 - 1) * GALAXY_BAR
      const w = gauss() * (R * 0.03 - (Math.abs(t) / GALAXY_BAR) * R * 0.012)
      x = t * Math.cos(GALAXY_BAR_ANGLE) - w * Math.sin(GALAXY_BAR_ANGLE)
      z = t * Math.sin(GALAXY_BAR_ANGLE) + w * Math.cos(GALAXY_BAR_ANGLE)
      y = gauss() * H * 0.6
      c = core
      s = 1.1 + rnd()
    } else if (r < 0.8) {
      // arms: two major (72%), two minor
      const major = rnd() < 0.72
      const arm = major ? (rnd() < 0.5 ? 0 : 1) : rnd() < 0.5 ? 2 : 3
      const t = Math.pow(rnd(), 0.85)
      const a = armPoint(arm, t)
      const spread = R * ((major ? 0.012 : 0.02) + 0.045 * t)
      const g1 = gauss() * spread
      const g2 = gauss() * spread * 0.5
      x = a.x + g1 * Math.cos(a.th + Math.PI / 2) + g2 * Math.cos(a.th)
      z = a.z + g1 * Math.sin(a.th + Math.PI / 2) + g2 * Math.sin(a.th)
      y = gauss() * H * (0.3 + 0.5 * (1 - t))
      const hii = major && rnd() < 0.035
      if (hii) c = pink
      else if (t > 0.22) {
        const k = Math.min(1, (t - 0.22) / 0.7) // violet (inner) → cyan (outer), no allocation per star
        armCol[0] = violet[0] + (cyan[0] - violet[0]) * k
        armCol[1] = violet[1] + (cyan[1] - violet[1]) * k
        armCol[2] = violet[2] + (cyan[2] - violet[2]) * k
        c = armCol
      } else c = white
      s = hii ? 2.2 + rnd() * 1.8 : 0.7 + rnd() * 1.1
      if (!major) s *= 0.8
    } else if (r < 0.965) {
      // diffuse disc
      const rr = R * Math.sqrt(rnd()) * 1.1
      const th = rnd() * Math.PI * 2
      x = Math.cos(th) * rr
      z = Math.sin(th) * rr
      y = gauss() * H * 0.7
      c = dust
      s = 0.55 + rnd() * 0.5
    } else {
      // globular clusters in the halo
      const cl = clusters[Math.floor(rnd() * clusters.length)]
      const rr = Math.abs(gauss()) * R * 0.012
      const th = rnd() * Math.PI * 2
      const ph = Math.acos(2 * rnd() - 1)
      x = cl[0] + rr * Math.sin(ph) * Math.cos(th)
      y = cl[1] + rr * Math.cos(ph)
      z = cl[2] + rr * Math.sin(ph) * Math.sin(th)
      c = core
      s = 0.9 + rnd() * 0.8
    }
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = z
    const j = 0.88 + rnd() * 0.24
    col[i * 3] = c[0] * j
    col[i * 3 + 1] = c[1] * j
    col[i * 3 + 2] = c[2] * j
    // a rare, very bright star (the "occasional bright stars")
    size[i] = rnd() < 0.004 ? s * 4 : s
    sd[i] = rnd()
  }
  return { pos, col, size, seed: sd }
}

/** Big soft sprites: glowing HII regions (additive) and dark dust lanes (normal blend). */
export function makeGalaxyClouds(nGlow: number, nDust: number, seed = 42) {
  const rnd = mulberry32(seed)
  const gauss = gaussFrom(rnd)
  const R = GALAXY_R
  const glow = { pos: new Float32Array(nGlow * 3), col: new Float32Array(nGlow * 3), size: new Float32Array(nGlow) }
  const palette = [
    [1.0, 0.25, 0.78], // magenta
    [0.55, 0.36, 1.0], // violet
    [0.25, 0.88, 1.0], // cyan
    [0.2, 0.35, 1.0], // deep blue
    [1.0, 0.62, 0.3], // the rare warm one
  ]
  for (let i = 0; i < nGlow; i++) {
    const arm = rnd() < 0.8 ? (rnd() < 0.5 ? 0 : 1) : 2 + Math.floor(rnd() * 2)
    const t = Math.pow(rnd(), 0.9)
    const a = armPoint(arm, t)
    const sp = R * (0.01 + 0.03 * t)
    glow.pos.set([a.x + gauss() * sp, gauss() * R * 0.006, a.z + gauss() * sp], i * 3)
    const c = palette[Math.floor(rnd() * palette.length)]
    glow.col.set([c[0], c[1], c[2]], i * 3)
    glow.size[i] = R * (0.02 + rnd() * 0.05)
  }
  // bulge glow sprites (warm core light)
  for (let i = 0; i < Math.min(18, nGlow); i++) {
    const rr = Math.abs(gauss()) * R * 0.05
    const th = rnd() * Math.PI * 2
    glow.pos.set([Math.cos(th) * rr, 0, Math.sin(th) * rr], i * 3)
    glow.col.set([1, 0.78, 0.55], i * 3)
    glow.size[i] = R * (0.12 + rnd() * 0.1)
  }
  const dust = { pos: new Float32Array(nDust * 3), size: new Float32Array(nDust) }
  for (let i = 0; i < nDust; i++) {
    const arm = rnd() < 0.5 ? 0 : 1
    const t = 0.02 + rnd() * 0.85
    const a = armPoint(arm, t)
    // inner (trailing) edge of the arm
    const inward = -R * (0.018 + 0.02 * t)
    dust.pos.set([a.x + Math.cos(a.th + Math.PI / 2) * inward + gauss() * R * 0.008, gauss() * R * 0.003, a.z + Math.sin(a.th + Math.PI / 2) * inward + gauss() * R * 0.008], i * 3)
    dust.size[i] = R * (0.025 + rnd() * 0.035)
  }
  return { glow, dust }
}

/**
 * The station's own cloud: an accretion swirl around Yashobhoomi. It's what makes the station
 * read as an abstract cosmic structure from afar, before its particles settle onto the architecture.
 */
export function makeAccretion(n: number, seed = 7) {
  const rnd = mulberry32(seed)
  const gauss = gaussFrom(rnd)
  const pos = new Float32Array(n * 3)
  const col = new Float32Array(n * 3)
  const size = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const arm = i % 2
    const t = Math.pow(rnd(), 0.7)
    const r = 520 + t * 2100
    const th = arm * Math.PI + Math.log(r / 520) / 0.34 + gauss() * 0.18
    const tilt = 0.12
    const x = Math.cos(th) * r + gauss() * (20 + 60 * t)
    const z = Math.sin(th) * r + gauss() * (20 + 60 * t)
    const y = gauss() * (14 + 40 * t) + x * tilt * 0.2
    pos.set([x, y, z], i * 3)
    const warm = rnd() < 0.12
    const c = warm ? [1.0, 0.72, 0.5] : t < 0.3 ? [0.92, 0.94, 1.0] : [0.55, 0.7, 1.0]
    col.set(c, i * 3)
    size[i] = 0.8 + rnd() * 1.3
  }
  return { pos, col, size }
}
