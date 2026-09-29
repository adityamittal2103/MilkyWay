'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { ORBIT, ORBIT_NODES, ORBIT_DAYS, orbitPoint } from '@/lib/sky'
import { EVENTS } from '@/data/provisional/events'
import { CATEGORIES } from '@/data/categories'
import { live, useWorld } from '@/lib/store'
import { S, U, damp } from './system'
import { glowLineGeometry, glowLineMaterial, glowLines, polylineSegments } from './vfx/glowLines'

/**
 * WOW 07, the Mission Timeline as orbits. Each festival day is a ring; the hour ticks run
 * 10:00 → 24:00 around it; events ride the ring at their time. A sweep hand turns slowly.
 * Filters (day / category / sector) dim non-matching nodes rather than removing them, so the
 * shape of the festival stays readable.
 */
const nodeVert = /* glsl */ `
  attribute vec3 aColor;
  attribute float aOn;
  attribute float aHot;
  uniform float uAmt; uniform float uDpr; uniform float uTime;
  varying vec3 vC; varying float vA; varying float vHot;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = mix(2.2, 5.0, aOn) + aHot * 5.0 + sin(uTime * 3.0 + position.x) * 0.3 * aOn;
    float px = clamp(s * uDpr * 360.0 / max(-mv.z, 1.0), 0.0, 44.0 * uDpr);
    vC = aColor; vA = uAmt * mix(0.18, 1.0, aOn); vHot = aHot;
    float m = 3.0; if (px < m) { vA *= pow(px / m, 1.5); px = m; } gl_PointSize = px; // never sub-pixel (see POINT_GLSL)
  }
`
const nodeFrag = /* glsl */ `
  varying vec3 vC; varying float vA; varying float vHot;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = (smoothstep(0.22, 0.12, d) + smoothstep(0.5, 0.0, d) * 0.4 + smoothstep(0.03, 0.0, abs(d - 0.42)) * vHot) * vA;
    gl_FragColor = vec4(mix(vC, vec3(1.0), 0.25) * a, a);
    #include <colorspace_fragment>
  }
`

const catColor = (id: string) => new THREE.Color(CATEGORIES.find((c) => c.id === id)?.accent ?? '#CFE0FF')

export function Orbits() {
  const dpr = useThree((s) => s.viewport.dpr)
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const group = useRef<THREE.Group>(null)
  const hand = useRef<THREE.Group>(null)
  // day rings carry a slow energy pulse (the timeline is running); ticks and the hand are plain glow
  const ringMat = useMemo(
    () =>
      glowLineMaterial({
        color: '#F1EDE4',
        width: 2.2,
        opacity: 0,
        fragment: { body: `float ph = fract(vT * 2.0 - uTime * 0.05); a *= 0.7 + 1.6 * exp(-ph * ph * 400.0);` },
      }),
    [],
  )
  const tickMat = useMemo(() => glowLineMaterial({ color: '#8B90A6', width: 2, opacity: 0, caps: true }), [])
  const handMat = useMemo(() => glowLineMaterial({ color: '#5B8CFF', width: 2.6, opacity: 0, caps: true }), [])
  const proj = useMemo(() => new THREE.Vector3(), [])
  const last = useRef<string | null>(null)

  const rings = useMemo(() => {
    const out: THREE.Mesh[] = []
    for (let d = 0; d < ORBIT_DAYS; d++) {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 160; i++) pts.push(orbitPoint(d, ORBIT.dayStart + (i / 160) * ORBIT.daySpan))
      const { seg, t } = polylineSegments(pts)
      out.push(glowLines(glowLineGeometry(seg, t), ringMat))
    }
    return out
  }, [ringMat])

  const ticks = useMemo(() => {
    const v: THREE.Vector3[] = []
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    for (let d = 0; d < ORBIT_DAYS; d++) {
      for (let h = 0; h < 14; h++) {
        const m = ORBIT.dayStart + h * 60
        orbitPoint(d, m, a)
        const r = ORBIT.radii[d]
        b.copy(a).sub(ORBIT.centre).multiplyScalar((r + (h % 2 === 0 ? 10 : 5)) / r).add(ORBIT.centre)
        v.push(a.clone(), b.clone())
      }
    }
    const seg = v.flatMap((p) => [p.x, p.y, p.z])
    return glowLines(glowLineGeometry(seg), tickMat)
  }, [tickMat])

  const nodes = useMemo(() => {
    const n = ORBIT_NODES.length
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    ORBIT_NODES.forEach((o, i) => {
      pos.set([o.pos.x, o.pos.y, o.pos.z], i * 3)
      const c = catColor(EVENTS[i].category)
      col.set([c.r, c.g, c.b], i * 3)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1))
    g.setAttribute('aHot', new THREE.BufferAttribute(new Float32Array(n), 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uAmt: { value: 0 }, uDpr: { value: 1 }, uTime: U.uTime },
    })
    return { g, m }
  }, [])

  const handLine = useMemo(() => glowLines(glowLineGeometry([0, 0, 0, ORBIT.radii[ORBIT_DAYS - 1] + 24, 0, 0]), handMat), [handMat])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const a = S.orbits
    if (group.current) group.current.visible = a > 0.005
    ringMat.uniforms.uOpacity.value = a * 0.55
    tickMat.uniforms.uOpacity.value = a * 0.5
    handMat.uniforms.uOpacity.value = a * 0.85
    nodes.m.uniforms.uAmt.value = a
    nodes.m.uniforms.uDpr.value = dpr
    if (hand.current) hand.current.rotation.y = -(S.time * 0.08) % (Math.PI * 2)

    const st = useWorld.getState()
    const on = nodes.g.getAttribute('aOn') as THREE.BufferAttribute
    const hot = nodes.g.getAttribute('aHot') as THREE.BufferAttribute
    EVENTS.forEach((e, i) => {
      const match = (st.day == null || st.day === e.day) && S.evOn[i] > 0.5 && (!st.filterZone || st.filterZone === e.zone)
      on.setX(i, damp(on.getX(i), match ? 1 : 0, 6, dt))
      hot.setX(i, damp(hot.getX(i), st.hoveredEvent === e.slug || st.selectedEvent === e.slug ? 1 : 0, 10, dt))
    })
    on.needsUpdate = true
    hot.needsUpdate = true

    // hover nearest node on screen
    if (st.mode === 'schedule' && !st.coarse) {
      let best: string | null = null
      let bd = 26
      if (live.pointer.active && live.pointer.overWorld) {
        ORBIT_NODES.forEach((o, i) => {
          if (on.getX(i) < 0.5) return
          proj.copy(o.pos).project(camera)
          const dx = ((proj.x + 1) / 2) * size.width - live.pointer.px
          const dy = ((1 - proj.y) / 2) * size.height - live.pointer.py
          const d = Math.hypot(dx, dy) * (o.slug === last.current ? 0.7 : 1) // hysteresis: sticky target
          if (d < bd) {
            bd = d
            best = o.slug
          }
        })
      }
      if (best !== last.current) {
        last.current = best
        st.set({ hoveredEvent: best })
      }
      live.hover3D = !!best
    }
  })

  return (
    <group ref={group}>
      {rings.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      <primitive object={ticks} />
      <group position={ORBIT.centre} rotation-x={ORBIT.tilt}>
        <group ref={hand}>
          <primitive object={handLine} />
        </group>
      </group>
      <points geometry={nodes.g} material={nodes.m} frustumCulled={false} />
    </group>
  )
}
