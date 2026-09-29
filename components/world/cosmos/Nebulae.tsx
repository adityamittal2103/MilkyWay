'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useWorld } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { armPoint } from '@/lib/galaxy'
import { GALAXY_CENTRE, GALAXY_QUAT, GALAXY_NORMAL } from '@/lib/universe'
import { NOISE_GLSL, S, U, budget } from '../system'

/**
 * Nebulae: procedural, domain-warped fbm on camera-facing billboards. Colour is used
 * selectively (most of the sky stays near-black), and each cloud has a place: three near the
 * Yashobhoomi system (you see them from the venue), the rest strung along the galaxy's arms.
 * Clouds fade as you fly into them, so they never become fog on the screen.
 */
type Neb = { pos: THREE.Vector3; size: number; a: string; b: string; seed: number; opacity: number }

const armWorld = (arm: number, t: number, lift = 0) => {
  const p = armPoint(arm, t)
  return new THREE.Vector3(p.x, lift, p.z).applyQuaternion(GALAXY_QUAT).add(GALAXY_CENTRE)
}

// order = priority: low tiers keep only the first few
const NEBULAE: Neb[] = [
  // the cosmic palette: violet · ultraviolet · deep blue · cyan, magenta and indigo as secondaries,
  // and exactly one warm cloud (special colours are rare)
  { pos: new THREE.Vector3(-16000, 5200, -24000), size: 26000, a: '#FF3EC8', b: '#6A2BFF', seed: 1.3, opacity: 0.95 }, // the Nursery, above the station
  { pos: new THREE.Vector3(21000, -3000, -18000), size: 18000, a: '#3FE0FF', b: '#2446FF', seed: 4.1, opacity: 0.85 }, // the Cyan Veil
  { pos: armWorld(0, 0.62, 600), size: 16000, a: '#A14DFF', b: '#3F7BFF', seed: 7.7, opacity: 0.85 },
  { pos: new THREE.Vector3(-26000, -9000, 9000), size: 20000, a: '#FF8A3D', b: '#A14DFF', seed: 2.9, opacity: 0.55 }, // Ember Drift: the warm one
  { pos: armWorld(1, 0.35, -400), size: 22000, a: '#4B3BFF', b: '#3FE0FF', seed: 9.2, opacity: 0.85 },
  { pos: armWorld(0, 0.28, 300), size: 20000, a: '#FF3EC8', b: '#4B3BFF', seed: 3.3, opacity: 0.75 },
  { pos: armWorld(1, 0.72, 0), size: 18000, a: '#6A2BFF', b: '#FF4F9A', seed: 5.5, opacity: 0.75 },
  { pos: GALAXY_CENTRE.clone().addScaledVector(GALAXY_NORMAL, 4000), size: 30000, a: '#FFB547', b: '#6A2BFF', seed: 8.1, opacity: 0.4 },
  { pos: armWorld(2, 0.5, 0), size: 16000, a: '#3FE0FF', b: '#7A5CFF', seed: 6.4, opacity: 0.65 },
  { pos: new THREE.Vector3(150000, 60000, -160000), size: 120000, a: '#2446FF', b: '#6A2BFF', seed: 11.2, opacity: 0.4 },
  { pos: new THREE.Vector3(-170000, -40000, 120000), size: 110000, a: '#4B3BFF', b: '#FF3EC8', seed: 12.9, opacity: 0.35 },
  { pos: armWorld(3, 0.6, 0), size: 14000, a: '#FF3EC8', b: '#3FE0FF', seed: 14.1, opacity: 0.65 },
]

const vert = /* glsl */ `
  attribute vec3 aCenter;
  attribute float aSize;
  attribute vec3 aColA;
  attribute vec3 aColB;
  attribute float aSeed;
  attribute float aOpacity;
  varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vSeed; varying float vO;
  void main() {
    vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
    float d = -mv.z;
    mv.xy += position.xy * aSize;
    gl_Position = projectionMatrix * mv;
    vUv = position.xy; vA = aColA; vB = aColB; vSeed = aSeed;
    // fade out as we enter the cloud; fade in with distance
    vO = aOpacity * smoothstep(aSize * 0.35, aSize * 1.3, d);
  }
`
const frag = /* glsl */ `
  ${NOISE_GLSL}
  uniform int OCT;
  uniform float uTime; uniform float uAmt; uniform vec3 uAccent; uniform float uFilterAmt;
  varying vec2 vUv; varying vec3 vA; varying vec3 vB; varying float vSeed; varying float vO;
  void main() {
    vec2 uv = vUv * 2.2;
    float t = uTime * 0.006;
    vec3 p = vec3(uv, vSeed);
    vec2 q = vec2(fbm3(p + vec3(0.0, 0.0, t), OCT), fbm3(p + vec3(5.2, 1.3, t), OCT));
    float f = fbm3(vec3(uv + 2.2 * q, vSeed * 1.7 + t), OCT);
    float r = length(vUv) * 2.0;
    float mask = 1.0 - smoothstep(0.35 + f * 0.3, 1.0, r + (q.x - 0.5) * 0.4);
    float density = pow(clamp(f * 1.3 - 0.25, 0.0, 1.0), 2.2) * mask;
    vec3 col = mix(vA, vB, smoothstep(0.3, 0.8, q.y));
    col = mix(col, uAccent, uFilterAmt * 0.25);
    col += vec3(1.0, 0.95, 0.9) * pow(density, 5.0) * 0.8; // hot filaments
    float a = density * vO * uAmt * 0.72;
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`

export function Nebulae() {
  const tier = useWorld((s) => s.bootTier)
  const q = QUALITY[tier]
  const amt = useRef({ value: 1 })
  const oct = useRef({ value: q.nebulaOctaves })
  const { geo, mat } = useMemo(() => {
    const list = NEBULAE.slice(0, q.nebulae)
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const c = new THREE.Color()
    const f = (fn: (n: Neb) => number[]) => new Float32Array(list.flatMap(fn))
    g.setAttribute('aCenter', new THREE.InstancedBufferAttribute(f((n) => [n.pos.x, n.pos.y, n.pos.z]), 3))
    g.setAttribute('aSize', new THREE.InstancedBufferAttribute(f((n) => [n.size]), 1))
    g.setAttribute('aColA', new THREE.InstancedBufferAttribute(f((n) => c.set(n.a).toArray()), 3))
    g.setAttribute('aColB', new THREE.InstancedBufferAttribute(f((n) => c.set(n.b).toArray()), 3))
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(f((n) => [n.seed]), 1))
    g.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(f((n) => [n.opacity]), 1))
    g.instanceCount = list.length
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.uTime, uAmt: amt.current, uAccent: U.uAccent, uFilterAmt: U.uFilterAmt, OCT: oct.current },
    })
    return { geo: g, mat: m }
  }, [q.nebulae])

  useFrame(() => {
    // nebulae belong to space: they recede when the hall is the subject
    // nebulae answer discoveries and filters with a brief swell of light
    amt.current.value = Math.max(0.25, S.galaxy) * (1 - S.dim * 0.4) * (1 + S.chart * 0.6) * (1 + U.uFlash.value * 0.6)
    geo.instanceCount = Math.min(q.nebulae, budget('nebulae'))
    oct.current.value = Math.min(q.nebulaOctaves, budget('nebulaOctaves'))
  })

  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-7} />
}
