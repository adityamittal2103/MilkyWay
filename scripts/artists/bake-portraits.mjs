// Bakes the PLACEHOLDER identities for test transmissions: sculpted heads (signed distance fields,
// ray-marched offline), like plaster busts. They are not photographs and depict no real person.
// Output: public/artists/tx-00N.png, 240×300 RGBA — R = light, G = depth (near = bright), B = 0,
// A = cut-out mask (soft edge, dissolving toward the shoulders).
//
// usage: node scripts/artists/bake-portraits.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const W = 240
const H = 300

/* ───────── sdf toolkit */
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z)
function sphere(p, c, r) {
  return len3(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r
}
function ellipsoid(p, c, r) {
  const x = (p[0] - c[0]) / r[0]
  const y = (p[1] - c[1]) / r[1]
  const z = (p[2] - c[2]) / r[2]
  const k0 = len3(x, y, z)
  const k1 = len3(x / r[0], y / r[1], z / r[2])
  return k1 < 1e-6 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1
}
function capsule(p, a, b, ra, rb = ra) {
  const pa = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]
  const ba = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const h = Math.max(0, Math.min(1, (pa[0] * ba[0] + pa[1] * ba[1] + pa[2] * ba[2]) / (ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2])))
  return len3(pa[0] - ba[0] * h, pa[1] - ba[1] * h, pa[2] - ba[2] * h) - (ra + (rb - ra) * h)
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}
const smax = (a, b, k) => -smin(-a, -b, k)
function hash(x, y, z) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}
function noise(x, y, z) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = x - ix
  const fy = y - iy
  const fz = z - iz
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const w = fz * fz * (3 - 2 * fz)
  const l = (a, b, t) => a + (b - a) * t
  return l(
    l(l(hash(ix, iy, iz), hash(ix + 1, iy, iz), u), l(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v),
    l(l(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u), l(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v),
    w,
  )
}

/* ───────── the heads. y up, z toward the viewer, head ≈ 2 units tall */
const IDENTITIES = [
  { id: 'tx-001', yaw: 0.32, tilt: -0.04, hair: 'afro', jaw: 1.0, nose: 1.05, lips: 1.1, beard: false },
  { id: 'tx-002', yaw: -0.28, tilt: 0.05, hair: 'crop', jaw: 1.08, nose: 1.0, lips: 0.95, beard: true },
  { id: 'tx-003', yaw: 0.12, tilt: 0.0, hair: 'bun', jaw: 0.92, nose: 0.92, lips: 1.05, beard: false },
  { id: 'tx-004', yaw: -0.45, tilt: -0.08, hair: 'long', jaw: 0.95, nose: 0.98, lips: 1.0, beard: false },
]

function makeHead(o) {
  const cy = Math.cos(o.yaw)
  const sy = Math.sin(o.yaw)
  const ct = Math.cos(o.tilt)
  const st = Math.sin(o.tilt)
  // returns [distance, material]  0 skin · 1 eye · 2 hair · 3 lips · 4 cloth
  return (P) => {
    // body stays put; the head turns on the neck
    const shoulders = ellipsoid(P, [0, -2.05, -0.2], [1.55, 0.55, 0.7])
    const neck = capsule(P, [0, -0.6, -0.12], [0, -1.8, -0.12], 0.3, 0.36)
    let body = smin(shoulders, neck, 0.35)
    // head space: rotate about y (yaw), then x (tilt), around the neck pivot
    let x = P[0]
    let y = P[1] + 0.55
    let z = P[2]
    ;[x, z] = [cy * x - sy * z, sy * x + cy * z]
    ;[y, z] = [ct * y - st * z, st * y + ct * z]
    const p = [x, y - 0.55, z]

    let d = ellipsoid(p, [0, 0.28, -0.08], [0.7, 0.86, 0.8]) // cranium
    d = smin(d, ellipsoid(p, [0, -0.22, 0.06], [0.54 * o.jaw, 0.62, 0.62]), 0.32) // face + jaw
    d = smin(d, sphere(p, [0, -0.74, 0.22], 0.2 * o.jaw), 0.24) // chin
    for (const s of [-1, 1]) d = smin(d, sphere(p, [0.34 * s, -0.04, 0.3], 0.22), 0.2) // cheekbones
    d = smin(d, capsule(p, [-0.38, 0.28, 0.5], [0.38, 0.28, 0.5], 0.075), 0.12) // brow ridge
    // eye sockets carved, eyeballs set deep, lids over them (almond, not a doll's disc)
    for (const s of [-1, 1]) d = smax(d, -ellipsoid(p, [0.25 * s, 0.1, 0.6], [0.17, 0.12, 0.14]), 0.06)
    for (const s of [-1, 1]) d = smin(d, capsule(p, [0.13 * s, 0.155, 0.57], [0.37 * s, 0.14, 0.5], 0.028), 0.03) // upper lids
    for (const s of [-1, 1]) d = smin(d, capsule(p, [0.15 * s, 0.035, 0.56], [0.35 * s, 0.045, 0.5], 0.018), 0.03) // lower lids
    // nose: bridge → tip, with nostrils
    d = smin(d, capsule(p, [0, 0.16, 0.6], [0, -0.2, 0.8 * o.nose], 0.065, 0.1), 0.08)
    d = smin(d, sphere(p, [0, -0.22, 0.76 * o.nose], 0.105), 0.06)
    for (const s of [-1, 1]) d = smin(d, sphere(p, [0.085 * s, -0.25, 0.68], 0.07), 0.05)
    // ears
    for (const s of [-1, 1]) d = smin(d, ellipsoid(p, [0.7 * s, 0.05, -0.08], [0.09, 0.22, 0.15]), 0.06)
    let mat = 0
    // lips: a cupid's-bow upper lip and a fuller lower lip, soft into the face
    const w = o.lips
    const lipU = Math.min(capsule(p, [-0.15 * w, -0.44, 0.6], [0, -0.425, 0.655], 0.03), capsule(p, [0, -0.425, 0.655], [0.15 * w, -0.44, 0.6], 0.03))
    const lipL = capsule(p, [-0.11 * w, -0.5, 0.61], [0.11 * w, -0.5, 0.61], 0.042)
    const lips = Math.min(lipU, lipL)
    d = smin(d, lips, 0.06)
    if (lips < 0.012) mat = 3
    d = smax(d, -capsule(p, [-0.14 * w, -0.463, 0.68], [0.14 * w, -0.463, 0.68], 0.008), 0.012)
    // eyes
    let eyes = 1e9
    for (const s of [-1, 1]) eyes = Math.min(eyes, sphere(p, [0.25 * s, 0.095, 0.45], 0.118))
    if (eyes < d) {
      d = eyes
      mat = 1
    }
    // hair
    let hair = 1e9
    const n = (a, b, c, f) => noise(a * f, b * f, c * f)
    if (o.hair === 'afro') hair = sphere(p, [0, 0.55, -0.2], 1.02) - n(p[0], p[1], p[2], 9) * 0.06
    if (o.hair === 'crop') hair = ellipsoid(p, [0, 0.44, -0.12], [0.77, 0.76, 0.86]) - n(p[0], p[1], p[2], 22) * 0.02
    if (o.hair === 'bun') hair = smin(ellipsoid(p, [0, 0.42, -0.14], [0.76, 0.78, 0.86]), sphere(p, [0, 0.98, -0.42], 0.3), 0.12) - n(p[0], p[1], p[2], 30) * 0.012
    if (o.hair === 'long') hair = smin(ellipsoid(p, [0, 0.4, -0.16], [0.8, 0.8, 0.88]), ellipsoid(p, [0, -0.55, -0.35], [0.82, 1.05, 0.45]), 0.25) - n(p[0], p[1], p[2], 14) * 0.03
    // hairline: keep the forehead and face clear
    hair = smax(hair, -(ellipsoid(p, [0, -0.12, 0.42], [0.6, 0.7, 0.56])), 0.08)
    if (o.beard) {
      const b = smax(ellipsoid(p, [0, -0.58, 0.28], [0.52, 0.42, 0.4]) - n(p[0], p[1], p[2], 26) * 0.02, -capsule(p, [-0.2, -0.47, 0.7], [0.2, -0.47, 0.7], 0.1), 0.05)
      hair = Math.min(hair, smax(b, p[1] + 0.2, 0.05))
    }
    if (hair < d) {
      d = smin(d, hair, 0.03)
      mat = 2
    }
    if (body < d) {
      d = smin(d, body, 0.12)
      mat = P[1] < -1.35 ? 4 : 0
    }
    return [d, mat, p]
  }
}

/* ───────── render */
function render(o) {
  const sdf = makeHead(o)
  const out = new Uint8Array(W * H * 4)
  const cam = [0, -0.1, 5.4]
  const tanY = Math.tan((38 * Math.PI) / 360)
  const tanX = tanY * (W / H)
  const L1 = norm([-0.55, 0.6, 0.6]) // key
  const L2 = norm([0.75, 0.05, 0.45]) // fill
  const L3 = norm([0.55, 0.35, -0.75]) // rim
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const u = ((i + 0.5) / W) * 2 - 1
      const v = 1 - ((j + 0.5) / H) * 2
      const d = norm([u * tanX, v * tanY, -1])
      let t = 3.2
      let hit = false
      let minD = 1e9
      let res = [1e9, 0]
      for (let k = 0; k < 140 && t < 8.5; k++) {
        const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t]
        res = sdf(p)
        minD = Math.min(minD, res[0] / t)
        if (res[0] < 0.0012) {
          hit = true
          break
        }
        t += res[0] * 0.85
      }
      const o4 = (j * W + i) * 4
      if (!hit) {
        // antialiased silhouette from the closest approach
        const a = Math.max(0, 1 - minD / 0.0035)
        out[o4 + 3] = Math.round(a * a * 90)
        continue
      }
      const p = [cam[0] + d[0] * t, cam[1] + d[1] * t, cam[2] + d[2] * t]
      const e = 0.0025
      const nx = sdf([p[0] + e, p[1], p[2]])[0] - sdf([p[0] - e, p[1], p[2]])[0]
      const ny = sdf([p[0], p[1] + e, p[2]])[0] - sdf([p[0], p[1] - e, p[2]])[0]
      const nz = sdf([p[0], p[1], p[2] + e])[0] - sdf([p[0], p[1], p[2] - e])[0]
      const n = norm([nx, ny, nz])
      // ambient occlusion along the normal
      let ao = 0
      for (let s = 1; s <= 5; s++) {
        const h = 0.035 * s
        ao += (h - sdf([p[0] + n[0] * h, p[1] + n[1] * h, p[2] + n[2] * h])[0]) / Math.pow(2, s)
      }
      ao = Math.max(0, Math.min(1, 1 - ao * 5))
      const mat = res[1]
      const albedo = [0.92, 0.55, 0.52, 0.78, 0.6][mat]
      const dif = Math.max(0, dot(n, L1))
      const fill = Math.max(0, dot(n, L2)) * 0.28
      const fres = Math.pow(1 - Math.max(0, -dot(n, d)), 3)
      const rim = fres * Math.max(0, dot(n, L3) + 0.35) * 0.9
      const refl = sub(d, scale(n, 2 * dot(d, n)))
      const spec = Math.pow(Math.max(0, dot(refl, L1)), mat === 1 ? 60 : 18) * (mat === 1 ? 0.9 : 0.18)
      let lum = albedo * (0.06 + 0.9 * dif * (0.35 + 0.65 * ao) + fill * ao) + rim + spec
      if (mat === 2) lum *= 0.75 + 0.5 * noise(p[0] * 40, p[1] * 90, p[2] * 40) // hair strands
      if (mat === 1) {
        // iris + pupil read as dark discs looking out of the face
        const hp = res[2] // head space: the eyes look out of the face, not the frame
        const ex = hp[0] > 0 ? 0.25 : -0.25
        const r = Math.hypot(hp[0] - ex, hp[1] - 0.1)
        // a soft iris and pupil (never a black disc); the catchlight comes from the specular term
        lum *= 1 - 0.55 * (1 - smooth(0.03, 0.062, r)) - 0.25 * (1 - smooth(0.012, 0.026, r))
      }
      // dissolve into the shoulders: the portrait never ends in a hard edge
      const fade = smooth(-2.25, -1.45, p[1])
      out[o4] = Math.round(Math.max(0, Math.min(1, lum)) * 255)
      out[o4 + 1] = Math.round(Math.max(0, Math.min(1, (p[2] + 1.2) / 2.4)) * 255)
      out[o4 + 2] = 0
      out[o4 + 3] = Math.round(255 * fade)
    }
  return out
}
function norm(v) {
  const l = Math.hypot(...v) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/* ───────── png */
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
function png(rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0
    Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync('public/artists', { recursive: true })
for (const o of IDENTITIES) {
  const t0 = Date.now()
  const buf = png(render(o))
  writeFileSync(`public/artists/${o.id}.png`, buf)
  console.log(`${o.id}.png  ${(buf.length / 1024).toFixed(0)} KB  ${Date.now() - t0} ms`)
}
