'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { live } from '@/lib/store'
import { SUN_DIR } from '@/lib/universe'
import { S, U } from '../system'

/**
 * VFX library (the context-driven ones; streaks, nebulae, dust, constellation drawing,
 * scanning beams and heat live with their systems).
 *   Sun      · a distant star with a rare solar-flare light event
 *   Burst    · energy pulse + particle burst at a click / arrival point (any scale)
 *   Portal   · the ring you fly through on a route jump
 */

/* ───────────── Sun: far, small, and every ~45 s it flares */
const sunFrag = /* glsl */ `
  uniform float uFlare; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c);
    float core = exp(-r * r * 900.0);
    float glow = exp(-r * r * 60.0) * 0.35;
    // atan(0,0) is undefined (NaN on some GPUs), and bloom would smear one NaN across the frame
    float ang = atan(c.y, c.x + 1e-5);
    float rays = pow(abs(sin(ang * 6.0 + uTime * 0.05)), 18.0) * exp(-r * 9.0) * 0.4;
    float a = core + glow * (1.0 + uFlare * 2.0) + rays * (0.3 + uFlare * 1.8);
    vec3 col = mix(vec3(1.0, 0.8, 0.6), vec3(1.0, 0.97, 0.92), core);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`
const billVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`

export function Sun() {
  const ref = useRef<THREE.Mesh>(null)
  const flare = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: billVert, fragmentShader: sunFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uFlare: flare, uTime: U.uTime } }),
    [flare],
  )
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    m.position.copy(camera.position).addScaledVector(SUN_DIR, 300000)
    m.quaternion.copy(camera.quaternion)
    // flare envelope: quiet most of the time, one slow swell every ~45 s
    const ph = (S.time % 45) / 45
    flare.value = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2 - 1.2)), 6)
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={-8} frustumCulled={false}>
      <planeGeometry args={[60000, 60000]} />
    </mesh>
  )
}

/* ───────────── Burst: ring + sparks at live.pulse, sized to the camera distance */
const ringFrag = /* glsl */ `
  uniform float uAge; uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float t = uAge / 1.1;
    float ring = 1.0 - smoothstep(0.0, 0.05 + t * 0.05, abs(r - t));
    float inner = (1.0 - smoothstep(0.0, 0.02, abs(r - t * 0.6))) * 0.5;
    float a = (ring + inner) * (1.0 - t) * step(t, 1.0);
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`
const sparkVert = /* glsl */ `
  attribute vec3 aDir;
  uniform float uAge; uniform float uScale; uniform float uDpr;
  varying float vA;
  void main() {
    float t = uAge / 1.1;
    float k = 1.0 - clamp(t, 0.0, 1.0);
    vec3 p = position + aDir * uScale * (1.0 - k * k * k) * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 3.0 * uDpr * (1.0 - t);
    vA = (1.0 - t) * step(t, 1.0);
  }
`
const sparkFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`

export function Burst() {
  const g = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const age = useMemo(() => ({ value: 10 }), [])
  const scale = useMemo(() => ({ value: 100 }), [])
  const ringMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: billVert, fragmentShader: ringFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAge: age, uColor: U.uPulseColor } }),
    [age],
  )
  const sparks = useMemo(() => {
    const n = 64
    const dir = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.4 + Math.random() * 0.6)
      dir.set([v.x, v.y, v.z], i * 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3))
    const mat = new THREE.ShaderMaterial({ vertexShader: sparkVert, fragmentShader: sparkFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAge: age, uScale: scale, uColor: U.uPulseColor, uDpr: U.uDpr } })
    return { geo, mat }
  }, [age, scale])

  useFrame(({ camera }) => {
    age.value = S.time - live.pulse.t
    const on = age.value >= 0 && age.value < 1.1
    if (!g.current || !ring.current) return
    g.current.visible = on
    if (!on) return
    g.current.position.set(live.pulse.x, live.pulse.y, live.pulse.z)
    const d = camera.position.distanceTo(g.current.position)
    scale.value = d * 0.35
    ring.current.scale.setScalar(d * 0.35)
    ring.current.quaternion.copy(camera.quaternion)
  })

  return (
    <group ref={g} visible={false}>
      <mesh ref={ring} material={ringMat} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <points geometry={sparks.geo} material={sparks.mat} frustumCulled={false} />
    </group>
  )
}

/* ───────────── Portal: a ring of light the camera passes through on a route jump */
const portalFrag = /* glsl */ `
  uniform float uWarp; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0;
    float ang = atan(c.y, c.x + 1e-5);
    float q = (r - 0.62) * 9.0;
    float ring = exp(-q * q); // (pow() of a negative base is undefined in GLSL)
    float swirl = 0.6 + 0.4 * sin(ang * 12.0 - uTime * 6.0 + r * 10.0);
    float inner = exp(-r * r * 3.0) * 0.25;
    vec3 col = mix(vec3(0.36, 0.55, 1.0), vec3(1.0, 0.95, 0.9), ring * 0.6);
    float a = (ring * swirl + inner) * uWarp;
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`
export function Portal() {
  const ref = useRef<THREE.Mesh>(null)
  const w = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: billVert, fragmentShader: portalFrag, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uWarp: w, uTime: U.uTime } }),
    [w],
  )
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    w.value = Math.sin(Math.min(1, S.warp) * Math.PI) * 0.9
    m.visible = w.value > 0.01
    // the ring rushes toward the camera as warp builds
    const z = 60 - S.warp * 56
    m.position.set(0, 0, -z).applyMatrix4(camera.matrixWorld)
    m.quaternion.copy(camera.quaternion)
    m.scale.setScalar(z * 1.1)
  })
  return (
    <mesh ref={ref} material={mat} renderOrder={20} frustumCulled={false} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
