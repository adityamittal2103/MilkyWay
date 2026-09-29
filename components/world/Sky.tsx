'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SKY } from '@/lib/sky'
import { CATEGORIES } from '@/data/categories'
import { live, useWorld } from '@/lib/store'
import { S, U } from './system'
import { glowLineGeometry, glowLineMaterial, glowLines } from './vfx/glowLines'

/**
 * WOW 06, constellation events. Each category is a hand-drawn constellation on a dome above the
 * hall. Idle: faint dashed lines. Hover: lines solidify and a pulse travels along them. Select:
 * the camera flies in and the category's events bloom as smaller stars with labels.
 */
const NCAT = CATEGORIES.length

const starVert = /* glsl */ `
  #define NCAT ${NCAT}
  attribute float aCat;
  attribute float aKind; // 0 = constellation star, 1 = event star
  attribute float aSize;
  uniform float uCatFocus[NCAT];
  uniform float uCatFilter[NCAT];
  uniform float uSky; uniform float uTime; uniform float uDpr;
  varying float vA; varying float vKind; varying float vFocus; varying float vCore;
  void main() {
    int c = int(aCat + 0.5);
    float f = 0.0;
    for (int i = 0; i < NCAT; i++) if (i == c) f = max(uCatFocus[i], uCatFilter[i] * 0.6);
    vFocus = f; vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.8 + 0.2 * sin(uTime * 2.0 + aSize * 20.0 + aCat);
    float s = aKind > 0.5 ? mix(0.0, 7.0, f) : aSize * (1.0 + f * 0.6);
    float px = clamp(s * tw * uDpr * 300.0 / max(-mv.z, 1.0), 0.0, 48.0 * uDpr);
    vA = uSky * (aKind > 0.5 ? f : (0.55 + 0.45 * f));
    vCore = smoothstep(5.0, 9.0, px);
    float m = 3.0; if (px < m) { vA *= pow(px / m, 1.5); px = m; } gl_PointSize = px; // never sub-pixel (see POINT_GLSL)
  }
`
const starFrag = /* glsl */ `
  uniform vec3 uColA; uniform vec3 uColB;
  varying float vA; varying float vKind; varying float vFocus; varying float vCore;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.12, 0.0, d) * vCore;
    float halo = smoothstep(0.5, 0.0, d) * 0.35;
    // four-point diffraction spikes on the constellation stars
    float spikes = (smoothstep(0.035, 0.0, abs(c.x)) + smoothstep(0.035, 0.0, abs(c.y))) * smoothstep(0.5, 0.1, d) * (1.0 - vKind) * 0.5;
    float a = (core + halo + spikes) * vA;
    vec3 col = mix(uColA, uColB, vKind);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`
// constellation lines (glow lines): discovered, not shown; they draw from the first star as focus
// builds, then energy runs along them
const LINE_HOOKS = {
  vertex: {
    head: `#define NCAT ${NCAT}
      attribute float aCat; uniform float uCatFocus[NCAT]; uniform float uCatFilter[NCAT]; varying float vF;`,
    body: `int c = int(aCat + 0.5); vF = 0.0;
      for (int i = 0; i < NCAT; i++) if (i == c) vF = max(uCatFocus[i], uCatFilter[i] * 0.999);
      vCull = vF < 0.001 ? 1.0 : 0.0;`,
  },
  fragment: {
    head: 'uniform float uSky; uniform vec3 uHot; varying float vF;',
    body: `if (vT > vF) discard;
      float head = smoothstep(0.08, 0.0, vF - vT) * (1.0 - smoothstep(0.985, 0.995, vF));
      float pulse = smoothstep(0.1, 0.0, abs(fract(vT - uTime * 0.6) - 0.5) - 0.4) * smoothstep(0.98, 0.99, vF);
      a *= uSky * (0.75 + pulse * 0.9 + head * 1.1);
      col = mix(col, uHot, vF * pulse);`,
  },
}

export function Sky() {
  const dpr = useThree((s) => s.viewport.dpr)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const group = useRef<THREE.Group>(null)
  const catFocus = useMemo(() => ({ value: new Array(NCAT).fill(0) as number[] }), [])
  const catFilter = useMemo(() => ({ value: new Array(NCAT).fill(0) as number[] }), [])
  const uSky = useMemo(() => ({ value: 0 }), [])
  const proj = useMemo(() => new THREE.Vector3(), [])
  const last = useRef<string | null>(null)

  const stars = useMemo(() => {
    const pos: number[] = []
    const cat: number[] = []
    const kind: number[] = []
    const sz: number[] = []
    SKY.forEach((s, ci) => {
      s.stars.forEach((p, i) => {
        pos.push(p.x, p.y, p.z)
        cat.push(ci)
        kind.push(0)
        sz.push(i === 0 || i === s.stars.length - 1 ? 13 : 8 + (i % 3) * 1.5)
      })
      s.events.forEach((e) => {
        pos.push(e.pos.x, e.pos.y, e.pos.z)
        cat.push(ci)
        kind.push(1)
        sz.push(3)
      })
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('aCat', new THREE.Float32BufferAttribute(cat, 1))
    g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1))
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(sz, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uCatFocus: catFocus, uCatFilter: catFilter, uSky, uTime: U.uTime, uDpr: { value: 1 }, uColA: { value: new THREE.Color('#F1EDE4') }, uColB: { value: new THREE.Color('#5B8CFF') } },
    })
    return { g, m }
  }, [catFocus, uSky])

  const lines = useMemo(() => {
    const pos: number[] = []
    const cat: number[] = []
    const t: number[] = []
    SKY.forEach((s, ci) => {
      let acc = 0
      const start = t.length
      s.edges.forEach(([a, b]) => {
        const pa = s.stars[a]
        const pb = s.stars[b]
        const len = pa.distanceTo(pb)
        pos.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
        cat.push(ci)
        t.push(acc, acc + len)
        acc += len
      })
      for (let j = start; j < t.length; j++) t[j] = (t[j] / acc) * 0.92
      // event stars tether to their parent star
      s.events.forEach((e, i) => {
        const parent = s.stars[(i * 2 + 1) % s.stars.length]
        pos.push(parent.x, parent.y, parent.z, e.pos.x, e.pos.y, e.pos.z)
        cat.push(ci)
        t.push(0.92, 0.99)
      })
    })
    const g = glowLineGeometry(pos, t, { aCat: { data: cat, size: 1 } })
    const m = glowLineMaterial({ color: '#CFE0FF', width: 2.4, caps: true, uniforms: { uCatFocus: catFocus, uCatFilter: catFilter, uSky, uHot: { value: new THREE.Color('#FF3E9A') } }, ...LINE_HOOKS })
    return glowLines(g, m)
  }, [catFocus, catFilter, uSky])

  useFrame(() => {
    for (let i = 0; i < NCAT; i++) {
      catFocus.value[i] = S.catFocus[i]
      catFilter.value[i] = S.catFilter[i]
    }
    uSky.value = S.sky
    stars.m.uniforms.uDpr.value = dpr
    if (group.current) group.current.visible = S.sky > 0.005

    // hover: nearest constellation centre on screen (only on the events routes, over empty sky)
    const st = useWorld.getState()
    if ((st.mode === 'events' || st.mode === 'competitions') && !st.coarse) {
      let best: string | null = null
      let bd = 150
      if (live.pointer.active && live.pointer.overWorld) {
        for (const s of SKY) {
          proj.copy(s.centre).project(camera)
          if (proj.z > 1) continue
          const dx = ((proj.x + 1) / 2) * size.width - live.pointer.px
          const dy = ((1 - proj.y) / 2) * size.height - live.pointer.py
          const d = Math.hypot(dx, dy) * (s.id === last.current ? 0.7 : 1) // hysteresis: the current target is sticky
          if (d < bd) {
            bd = d
            best = s.id
          }
        }
      }
      if (best !== last.current) {
        last.current = best
        st.set({ hoveredCategory: best })
      }
      live.hover3D = !!best
    }
  })

  return (
    <group ref={group}>
      <points geometry={stars.g} material={stars.m} frustumCulled={false} />
      <primitive object={lines} />
    </group>
  )
}
