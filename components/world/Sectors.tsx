'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { ZONES } from '@/data/zones'
import { GATE } from '@/data/zones'
import { S, T, U, damp } from './system'

/**
 * WOW 05, sector scan: a column of light rises from the focused sector and a ring of dust
 * orbits it. One beacon travels between sectors (it never pops), sized to each sector.
 */
const beamVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const beamFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uAmt; uniform float uTime;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 2.2);
    float bands = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 4.0);
    float edge = pow(abs(sin(vUv.x * 3.14159 * 2.0)), 0.5);
    float a = fade * bands * uAmt * (0.25 + 0.35 * edge);
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`
const ringVert = /* glsl */ `
  attribute float aT;
  uniform float uTime; uniform float uAmt; uniform float uDpr;
  varying float vA;
  void main() {
    float a = aT * 6.28318 + uTime * (0.4 + fract(aT * 7.0) * 0.6);
    float r = 1.0 + 0.12 * sin(aT * 50.0 + uTime);
    vec3 p = vec3(cos(a) * r, 0.02 * sin(aT * 90.0) + fract(aT * 13.0) * 0.4, sin(a) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = clamp(2.2 * uDpr * 300.0 / max(-mv.z, 1.0), 0.0, 8.0 * uDpr);
    vA = uAmt * (0.4 + 0.6 * fract(aT * 31.0));
    float m = 3.0; if (px < m) { vA *= pow(px / m, 1.5); px = m; } gl_PointSize = px; // never sub-pixel (see POINT_GLSL)
  }
`
const ringFrag = /* glsl */ `
  uniform vec3 uColor; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`

const ZONE_COLORS = ZONES.map((z) => new THREE.Color(z.accent))

export function SectorBeacon() {
  const g = useRef<THREE.Group>(null)
  const state = useRef({ x: 0, z: 0, sx: 40, sz: 40, amt: 0, col: new THREE.Color('#5B8CFF') })
  const beam = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color() }, uAmt: { value: 0 }, uTime: U.uTime },
      }),
    [],
  )
  const ring = useMemo(() => {
    const n = 220
    const t = new Float32Array(n)
    for (let i = 0; i < n; i++) t[i] = i / n
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: beam.uniforms.uColor, uAmt: { value: 0 }, uTime: U.uTime, uDpr: { value: 1.5 } },
    })
    return { geo, mat }
  }, [beam])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const i = T.current.focusZone
    const s = state.current
    const z = i >= 0 ? ZONES[i] : null
    if (z) {
      s.x = damp(s.x, z.centre[0], 6, dt)
      s.z = damp(s.z, z.centre[2], 6, dt)
      s.sx = damp(s.sx, (z.rect[2] - z.rect[0]) / 2, 6, dt)
      s.sz = damp(s.sz, (z.rect[3] - z.rect[1]) / 2, 6, dt)
      s.col.lerp(ZONE_COLORS[i], 1 - Math.exp(-6 * dt))
    }
    s.amt = damp(s.amt, z ? S.reveal : 0, 5, dt)
    beam.uniforms.uColor.value.copy(s.col)
    beam.uniforms.uAmt.value = s.amt
    ring.mat.uniforms.uAmt.value = s.amt
    if (g.current) {
      g.current.position.set(s.x, 0, s.z)
      g.current.visible = s.amt > 0.01
    }
  })

  const r = useRef<THREE.Group>(null)
  useFrame(() => {
    const s = state.current
    if (r.current) r.current.scale.set(Math.max(s.sx, 12) * 1.1, 26, Math.max(s.sz, 12) * 1.1)
  })

  return (
    <group ref={g}>
      <group ref={r}>
        <mesh material={beam} position={[0, 0.5, 0]}>
          <cylinderGeometry args={[1, 1, 1, 48, 1, true]} />
        </mesh>
        <points geometry={ring.geo} material={ring.mat} position={[0, 0.25, 0]} frustumCulled={false} />
      </group>
    </group>
  )
}

/** Boarding pad at the real entry gate (WOW 08). */
export function DockPad() {
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#FF7A1A', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  )
  const mat2 = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#F1EDE4', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    [],
  )
  useFrame(() => {
    const a = S.dock
    mat.opacity = a * 0.9
    mat2.opacity = a * 0.5
    if (g.current) {
      g.current.visible = a > 0.01
      g.current.rotation.y = S.time * 0.3
      g.current.children.forEach((c, i) => (c.position.y = 2 + i * 6 * a + Math.sin(S.time * 1.2 + i) * 0.4))
    }
  })
  return (
    <group ref={g} position={[GATE[0], 0, GATE[2] - 16]}>
      {[14, 10, 6].map((r, i) => (
        <mesh key={r} rotation-x={-Math.PI / 2} material={i === 0 ? mat : mat2}>
          <ringGeometry args={[r, r + (i === 0 ? 0.6 : 0.25), 64]} />
        </mesh>
      ))}
    </group>
  )
}
