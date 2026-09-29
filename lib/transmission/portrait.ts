'use client'
import { rng } from './signal'

/**
 * PHOTO → DATA. Turns a portrait into the particle cloud a transmission reconstructs.
 *
 *   1. luminance map        what is bright is dense and glows
 *   2. subject mask         cut-out alpha if the image has one; otherwise the background colour is
 *                           estimated from the border and an elliptical vignette is applied, so the
 *                           rectangle of the source image can never appear
 *   3. relief (depth)       baked identities carry real depth (G channel); photos get an estimate
 *                           (blurred luminance on an ellipsoid prior): a subtle 3D surface
 *   4. edge map (Sobel)     eyes, nose, mouth, jawline, hair outline: these particles lock first
 *   5. sampling             particles are laid out in SCANLINE STRANDS: each row of the face is a
 *                           waveform, and particles distribute along it by (light + edges) × mask.
 *                           They follow facial contours, not a grid.
 *
 * `baked` images: R = light, G = depth, A = mask (see scripts/artists/bake-portraits.mjs).
 * `photo` images: any JPG/PNG/WebP portrait; a transparent cut-out gives the best result.
 */
export type PortraitKind = 'baked' | 'photo'
export type PortraitCloud = {
  n: number
  rows: number
  aspect: number
  /** target position: x, y (portrait height = 2 units), z relief */
  pos: Float32Array
  /** per particle: light, edge, row (0 top → 1 bottom), seed */
  attr: Float32Array
}

const cache = new Map<string, Promise<PortraitCloud>>()

export function loadPortrait(src: string, kind: PortraitKind, count: number, seed: number) {
  const key = `${src}|${count}|${seed}`
  let p = cache.get(key)
  if (!p) {
    p = build(src, kind, count, seed)
    cache.set(key, p)
    p.catch(() => cache.delete(key))
  }
  return p
}

async function build(src: string, kind: PortraitKind, count: number, seed: number): Promise<PortraitCloud> {
  const img = new Image()
  img.decoding = 'async'
  img.src = src
  await img.decode()
  const H = Math.min(img.naturalHeight, 320)
  const W = Math.max(8, Math.round((H * img.naturalWidth) / img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, W, H)
  const px = g.getImageData(0, 0, W, H).data
  const N = W * H
  const L = new Float32Array(N)
  const M = new Float32Array(N)
  const D = new Float32Array(N)

  if (kind === 'baked') {
    for (let i = 0; i < N; i++) {
      L[i] = px[i * 4] / 255
      D[i] = px[i * 4 + 1] / 255
      M[i] = px[i * 4 + 3] / 255
    }
  } else {
    let hasAlpha = false
    for (let i = 0; i < N; i++) {
      L[i] = Math.pow((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255, 0.9)
      if (px[i * 4 + 3] < 250) hasAlpha = true
    }
    if (hasAlpha) for (let i = 0; i < N; i++) M[i] = px[i * 4 + 3] / 255
    else {
      // background = median colour of the border; the subject is whatever differs from it
      const border: number[][] = []
      const bw = Math.max(2, Math.round(W * 0.04))
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (x < bw || x >= W - bw || y < bw) border.push([px[(y * W + x) * 4], px[(y * W + x) * 4 + 1], px[(y * W + x) * 4 + 2]])
      const med = [0, 1, 2].map((k) => border.map((b) => b[k]).sort((a, b) => a - b)[border.length >> 1])
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(px[i * 4] - med[0], px[i * 4 + 1] - med[1], px[i * 4 + 2] - med[2]) / 441
        M[i] = smooth(0.06, 0.2, d)
      }
    }
    // the vignette: an ellipse around the head and shoulders, so no rectangle can ever show
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ex = (x / W - 0.5) / 0.47
        const ey = (y / H - 0.46) / 0.54
        M[y * W + x] *= 1 - smooth(0.78, 1, Math.hypot(ex, ey))
      }
    blur(M, W, H, 2)
    // relief estimate: soft luminance on an ellipsoid prior (a plausible bust, never a flat card)
    const b = Float32Array.from(L)
    blur(b, W, H, 6)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const ex = (x / W - 0.5) / 0.42
        const ey = (y / H - 0.4) / 0.5
        D[y * W + x] = Math.sqrt(Math.max(0, 1 - ex * ex - ey * ey)) * 0.55 + b[y * W + x] * 0.35 + 0.1
      }
  }

  // edges (Sobel on the masked luminance), normalised by the 95th percentile
  const E = new Float32Array(N)
  const lm = (x: number, y: number) => {
    const i = Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))
    return L[i] * M[i]
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const gx = lm(x + 1, y - 1) + 2 * lm(x + 1, y) + lm(x + 1, y + 1) - lm(x - 1, y - 1) - 2 * lm(x - 1, y) - lm(x - 1, y + 1)
      const gy = lm(x - 1, y + 1) + 2 * lm(x, y + 1) + lm(x + 1, y + 1) - lm(x - 1, y - 1) - 2 * lm(x, y - 1) - lm(x + 1, y - 1)
      E[y * W + x] = Math.hypot(gx, gy) * M[y * W + x]
    }
  const sorted = Float32Array.from(E).sort()
  const e95 = Math.max(1e-4, sorted[Math.floor(sorted.length * 0.95)])
  for (let i = 0; i < N; i++) E[i] = Math.min(1, E[i] / e95)

  // scanline strands: rows of the face, particles along each by (light + edges) × mask
  const R = Math.max(60, Math.min(190, Math.round(Math.sqrt(count) * 0.85)))
  const rowW = new Float32Array(R)
  const weights: Float32Array[] = []
  for (let j = 0; j < R; j++) {
    const y = Math.min(H - 1, Math.round(((j + 0.5) / R) * (H - 1)))
    const w = new Float32Array(W)
    let s = 0
    // attention: the face gets the most particles (eyes, nose and mouth need density), the
    // shoulders the fewest; hair keeps its silhouette with fewer points
    const fy = y / H
    const shoulders = 1 - 0.55 * smooth(0.68, 0.92, fy)
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      const m = M[i] < 0.08 ? 0 : M[i]
      const fx = (x / W - 0.5) / 0.2
      const fz = (fy - 0.42) / 0.2
      const face = 1 + 1.6 * Math.exp(-(fx * fx + fz * fz))
      w[x] = m * (0.05 + 0.95 * Math.pow(L[i], 1.15) + 1.25 * E[i]) * face * shoulders
      s += w[x]
    }
    weights.push(w)
    rowW[j] = s
  }
  const total = rowW.reduce((a, b) => a + b, 0) || 1
  const per = Array.from(rowW, (w) => Math.floor((w / total) * count))
  let left = count - per.reduce((a, b) => a + b, 0)
  for (let j = 0; left > 0; j = (j + 1) % R) if (rowW[j] > 0) (per[j]++, left--)

  const r = rng(seed)
  const pos = new Float32Array(count * 3)
  const attr = new Float32Array(count * 4)
  const aspect = W / H
  let k = 0
  const bil = (A: Float32Array, x: number, y: number) => {
    const x0 = Math.floor(x)
    const x1 = Math.min(W - 1, x0 + 1)
    const f = x - x0
    return A[y * W + x0] * (1 - f) + A[y * W + x1] * f
  }
  for (let j = 0; j < R; j++) {
    const n = per[j]
    if (!n) continue
    const w = weights[j]
    const y = Math.min(H - 1, Math.round(((j + 0.5) / R) * (H - 1)))
    // stratified inverse-CDF sampling: even coverage, no clumps, deterministic per seed
    let acc = 0
    let x = 0
    for (let q = 0; q < n; q++) {
      const target = ((q + r()) / n) * rowW[j]
      while (x < W - 1 && acc + w[x] < target) acc += w[x++]
      const fx = x + Math.min(1, Math.max(0, (target - acc) / Math.max(w[x], 1e-6)))
      const sx = Math.min(W - 1.001, fx)
      pos[k * 3] = (sx / W - 0.5) * 2 * aspect
      pos[k * 3 + 1] = -(((j + 0.5) / R) - 0.5) * 2 + (r() - 0.5) * (0.12 / R)
      pos[k * 3 + 2] = (bil(D, sx, y) - 0.5) * (kind === 'baked' ? 0.95 : 0.6)
      attr[k * 4] = bil(L, sx, y)
      attr[k * 4 + 1] = bil(E, sx, y)
      attr[k * 4 + 2] = j / (R - 1)
      attr[k * 4 + 3] = r()
      k++
    }
  }
  return { n: k, rows: R, aspect, pos: pos.subarray(0, k * 3), attr: attr.subarray(0, k * 4) }
}

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function blur(A: Float32Array, W: number, H: number, r: number) {
  const t = new Float32Array(A.length)
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0
        let n = 0
        for (let k = -r; k <= r; k++) {
          const xx = pass ? x : Math.min(W - 1, Math.max(0, x + k))
          const yy = pass ? Math.min(H - 1, Math.max(0, y + k)) : y
          s += A[yy * W + xx]
          n++
        }
        t[y * W + x] = s / n
      }
    A.set(t)
  }
}
