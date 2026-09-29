'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { SECTION_SKY } from '@/lib/sectionSky'
import { live, useWorld } from '@/lib/store'
import { setAnchor } from '@/lib/labels'
import { S, U, damp } from './system'
import { glowLineGeometry, glowLineMaterial, glowLines } from './vfx/glowLines'

/**
 * Discoverable section constellations (WOW: "click a distant star, a constellation is revealed").
 * Lines draw themselves from the brightest star outward when hovered; found ones stay drawn.
 */
const NS = SECTION_SKY.length
SECTION_SKY.forEach((s) => setAnchor(`sec:${s.id}`, s.labelAt))

const starVert = /* glsl */ `
  #define NS ${NS}
  attribute float aSec; attribute float aLead;
  uniform float uDraw[NS]; uniform float uAmt; uniform float uTime; uniform float uDpr;
  varying float vA; varying float vLead;
  void main() {
    int k = int(aSec + 0.5);
    float d = 0.0;
    for (int i = 0; i < NS; i++) if (i == k) d = uDraw[i];
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.75 + 0.25 * sin(uTime * 1.7 + aSec * 3.0 + aLead * 7.0);
    // the lead star is brighter from the start: it is the hint
    gl_PointSize = (aLead > 0.5 ? 7.0 : 3.2 + d * 2.5) * uDpr * tw;
    vA = uAmt * (aLead > 0.5 ? 0.95 : 0.35 + d * 0.65);
    vLead = aLead;
  }
`
const starFrag = /* glsl */ `
  varying float vA; varying float vLead;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = (smoothstep(0.5, 0.0, d) * 0.5 + smoothstep(0.14, 0.0, d)) * vA;
    a += (smoothstep(0.03, 0.0, abs(c.x)) + smoothstep(0.03, 0.0, abs(c.y))) * smoothstep(0.5, 0.0, d) * vLead * vA * 0.6;
    gl_FragColor = vec4(vec3(0.93, 0.95, 1.0) * a, a);
    #include <colorspace_fragment>
  }
`
// constellation lines are glow lines: they draw themselves from the lead star (vT ≤ progress)
const LINE_HOOKS = {
  vertex: {
    head: `#define NS ${NS}
      attribute float aSec; uniform float uDraw[NS]; varying float vD;`,
    body: `int k = int(aSec + 0.5); vD = 0.0;
      for (int i = 0; i < NS; i++) if (i == k) vD = uDraw[i];
      vCull = vD < 0.001 ? 1.0 : 0.0;`,
  },
  fragment: {
    head: 'uniform float uAmt; varying float vD;',
    body: `if (vT > vD) discard; // drawn progressively, never all at once
      float head = smoothstep(0.1, 0.0, vD - vT);
      a *= uAmt * (0.6 + head * 0.9);
      col = mix(col, vec3(1.0), head * 0.7);`,
  },
}

export function SectionSky() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const draw = useMemo(() => ({ value: new Array(NS).fill(0) as number[] }), [])
  const amt = useMemo(() => ({ value: 0 }), [])
  const group = useRef<THREE.Group>(null)
  const last = useRef<string | null>(null)
  const v = useMemo(() => new THREE.Vector3(), [])

  const { sg, sm, line } = useMemo(() => {
    const pos: number[] = []
    const sec: number[] = []
    const lead: number[] = []
    const lp: number[] = []
    const ls: number[] = []
    const lt: number[] = []
    // (per segment: 6 coords, 1 section index, 2 path params)
    SECTION_SKY.forEach((s, k) => {
      s.stars.forEach((p, i) => {
        pos.push(p.x, p.y, p.z)
        sec.push(k)
        lead.push(i === 0 ? 1 : 0)
      })
      // line draw order: breadth-first from the lead star
      s.edges.forEach(([a, b], i) => {
        const pa = s.stars[a]
        const pb = s.stars[b]
        lp.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z)
        ls.push(k)
        const t0 = i / s.edges.length
        lt.push(t0, t0 + 1 / s.edges.length)
      })
    })
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    sg.setAttribute('aSec', new THREE.Float32BufferAttribute(sec, 1))
    sg.setAttribute('aLead', new THREE.Float32BufferAttribute(lead, 1))
    const sm = new THREE.ShaderMaterial({ vertexShader: starVert, fragmentShader: starFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uDraw: draw, uAmt: amt, uTime: U.uTime, uDpr: U.uDpr } })
    const lg = glowLineGeometry(lp, lt, { aSec: { data: ls, size: 1 } })
    const lm = glowLineMaterial({ color: '#CFE0FF', width: 2.6, caps: true, uniforms: { uDraw: draw, uAmt: amt }, ...LINE_HOOKS })
    return { sg, sm, lg, lm, line: glowLines(lg, lm) }
  }, [draw, amt])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    amt.value = S.sectionSky
    if (group.current) group.current.visible = amt.value > 0.01
    const st = useWorld.getState()

    // hover: any star of a constellation within reach on screen
    let best: string | null = null
    if (amt.value > 0.5 && !st.coarse && live.pointer.active && live.pointer.overWorld && !live.orbit.dragging && !st.hoveredPlanet) {
      let bd = 42
      for (const s of SECTION_SKY) {
        for (const p of s.stars) {
          v.copy(p).project(camera)
          if (v.z > 1) continue
          const d = Math.hypot(((v.x + 1) / 2) * size.width - live.pointer.px, ((1 - v.y) / 2) * size.height - live.pointer.py) * (s.id === last.current ? 0.7 : 1) // sticky
          if (d < bd) {
            bd = d
            best = s.id
          }
        }
      }
    }
    if (best !== last.current) {
      last.current = best
      st.set({ hoveredConstellation: best })
      if (best) st.discover(`sky:${best}`)
    }
    if (best) {
      live.hoverKind = 'constellation'
      live.hoverLabel = SECTION_SKY.find((s) => s.id === best)!.label
    }
    SECTION_SKY.forEach((s, i) => {
      const found = st.discovered.includes(`sky:${s.id}`)
      const want = s.id === best ? 1 : found ? 1 : 0
      // drawing forward is deliberate (~1.2 s); fading back is quicker
      draw.value[i] = want > draw.value[i] ? Math.min(1, draw.value[i] + dt * 0.85) : damp(draw.value[i], want, 4, dt)
    })
  })

  return (
    <group ref={group}>
      <primitive object={line} />
      <points geometry={sg} material={sm} frustumCulled={false} />
    </group>
  )
}
