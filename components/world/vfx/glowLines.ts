'use client'
import * as THREE from 'three'
import { AA_GLSL, U } from '../system'

/**
 * GLOW LINES: every orbit, ring, constellation and energy path in the universe.
 *
 * WebGL lines are 1 px wide and aliased: as the camera moves they crawl and sparkle (flicker), and
 * they cannot glow. Instead each segment is an instanced quad expanded in the vertex shader to a
 * width in PIXELS with a soft glow profile. Widths never go below 3 physical px; a line asked to be
 * thinner fades instead (it stays stable at any distance). Additive, depth-tested, no depth write.
 *
 * Hooks let each system add its own behaviour without a new line renderer:
 *   vertex.head / vertex.body   extra attributes/uniforms; body may scale `widthScale` or set `vCull`
 *   fragment.head / fragment.body  body edits `a` (alpha) and `col` (colour); `vT` is the path parameter
 */
export type GlowLineHooks = {
  vertex?: { head?: string; body?: string }
  fragment?: { head?: string; body?: string }
}
export type GlowLineOpts = GlowLineHooks & {
  width?: number // CSS px
  color?: THREE.ColorRepresentation
  opacity?: number
  /** caps extend each segment by half its width: use for standalone segments, not smooth polylines */
  caps?: boolean
  /** NDC depth bias toward the camera (lines lying on a surface) */
  bias?: number
  depthTest?: boolean
  uniforms?: Record<string, THREE.IUniform>
}

/**
 * @param seg flat [ax, ay, az, bx, by, bz, …] per segment
 * @param t   flat [tA, tB, …] path parameter at each end (for dashes, pulses, progressive drawing)
 * @param extra per-segment instanced attributes, e.g. { aCat: { data, size: 1 } }
 */
export function glowLineGeometry(seg: ArrayLike<number>, t?: ArrayLike<number>, extra: Record<string, { data: ArrayLike<number>; size: number }> = {}) {
  const n = seg.length / 6
  const g = new THREE.InstancedBufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3))
  g.setIndex([0, 1, 2, 0, 2, 3])
  const a = new Float32Array(n * 3)
  const b = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    a.set([seg[i * 6], seg[i * 6 + 1], seg[i * 6 + 2]], i * 3)
    b.set([seg[i * 6 + 3], seg[i * 6 + 4], seg[i * 6 + 5]], i * 3)
  }
  g.setAttribute('aA', new THREE.InstancedBufferAttribute(a, 3))
  g.setAttribute('aB', new THREE.InstancedBufferAttribute(b, 3))
  const tt = new Float32Array(n * 2)
  if (t) tt.set(Array.from(t).slice(0, n * 2))
  else for (let i = 0; i < n; i++) tt.set([i / n, (i + 1) / n], i * 2)
  g.setAttribute('aT', new THREE.InstancedBufferAttribute(tt, 2))
  for (const [k, v] of Object.entries(extra)) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(Array.from(v.data)), v.size))
  g.instanceCount = n
  return g
}

/** A closed circle (or any polyline) as segments + a 0…1 path parameter. */
export function polylineSegments(points: THREE.Vector3[], closed = false) {
  const seg: number[] = []
  const t: number[] = []
  const pts = closed ? [...points, points[0]] : points
  let total = 0
  const lens = pts.slice(1).map((p, i) => {
    const l = p.distanceTo(pts[i])
    total += l
    return l
  })
  let acc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    seg.push(a.x, a.y, a.z, b.x, b.y, b.z)
    t.push(acc / total, (acc + lens[i]) / total)
    acc += lens[i]
  }
  return { seg, t }
}

export function circlePoints(r: number, n: number, y = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
  })
}

export function glowLineMaterial(o: GlowLineOpts = {}) {
  const vertexShader = /* glsl */ `
    attribute vec3 aA; attribute vec3 aB; attribute vec2 aT;
    uniform vec2 uRes; uniform float uDpr; uniform float uWidth; uniform float uBias; uniform float uCaps;
    varying float vAcross; varying float vT; varying float vCover; varying float vCull;
    ${o.vertex?.head ?? ''}
    void main() {
      float widthScale = 1.0;
      vCull = 0.0;
      ${o.vertex?.body ?? ''}
      vec4 a = projectionMatrix * modelViewMatrix * vec4(aA, 1.0);
      vec4 b = projectionMatrix * modelViewMatrix * vec4(aB, 1.0);
      const float nw = 0.05;
      if ((a.w < nw && b.w < nw) || vCull > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vCover = 0.0; return; }
      // clip against the near plane so segments passing the camera never explode across the screen
      if (a.w < nw) a = mix(a, b, (nw - a.w) / (b.w - a.w));
      if (b.w < nw) b = mix(b, a, (nw - b.w) / (a.w - b.w));
      vec2 hr = 0.5 * uRes;
      vec2 sa = a.xy / a.w * hr;
      vec2 sb = b.xy / b.w * hr;
      vec2 d = sb - sa;
      float len = length(d);
      vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
      vec2 nrm = vec2(-dir.y, dir.x);
      float w = 0.5 * uWidth * widthScale * max(uDpr, 1.0);
      float cover = 1.0;
      if (w < 1.5) { cover = pow(max(w, 0.0) / 1.5, 1.5); w = 1.5; }
      vec4 p = mix(a, b, position.x);
      vec2 off = nrm * position.y * w + dir * (position.x * 2.0 - 1.0) * w * uCaps;
      p.xy += off / hr * p.w;
      p.z -= uBias * p.w;
      gl_Position = p;
      vAcross = position.y;
      vT = mix(aT.x, aT.y, position.x);
      vCover = cover;
    }
  `
  const fragmentShader = /* glsl */ `
    uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
    varying float vAcross; varying float vT; varying float vCover; varying float vCull;
    ${AA_GLSL}
    ${o.fragment?.head ?? ''}
    void main() {
      float x = abs(vAcross);
      float glow = exp(-x * x * 5.0);
      float core = exp(-x * x * 24.0);
      float a = (glow * 0.45 + core * 0.75) * vCover * uOpacity;
      vec3 col = uColor;
      ${o.fragment?.body ?? ''}
      col = mix(col, vec3(1.0), core * 0.22);
      gl_FragColor = vec4(col * a, a);
      #include <colorspace_fragment>
    }
  `
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: o.depthTest ?? true,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRes: U.uRes,
      uDpr: U.uDpr,
      uTime: U.uTime,
      uWidth: { value: o.width ?? 2 },
      uBias: { value: o.bias ?? 0 },
      uCaps: { value: o.caps ? 1 : 0 },
      uColor: { value: new THREE.Color(o.color ?? '#CFE0FF') },
      uOpacity: { value: o.opacity ?? 1 },
      ...(o.uniforms ?? {}),
    },
  })
}

/** Mesh wrapper: frustum culling off (the quads are built in the shader). */
export function glowLines(geo: THREE.BufferGeometry, mat: THREE.ShaderMaterial) {
  const m = new THREE.Mesh(geo, mat)
  m.frustumCulled = false
  return m
}
