'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useWorld, live } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { makeGalaxyClouds, makeGalaxyStars } from '@/lib/galaxy'
import { GALAXY_CENTRE, GALAXY_QUAT, GALAXY_R } from '@/lib/universe'
import { S, U, POINT_GLSL, budget } from '../system'

/**
 * THE MILKY WAY. One draw call of stars, one of dust lanes, one of glowing HII regions and a
 * core flare. Moves slowly enough to feel enormous: only the inner galaxy rotates (differential
 * rotation), so Yashobhoomi's arm never drifts away from the station.
 */
const INV_GALAXY = GALAXY_QUAT.clone().invert()

const starVert = /* glsl */ `
  ${POINT_GLSL}
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSeed;
  uniform float uTime; uniform float uGlow; uniform float uSpin; uniform float uR;
  uniform vec2 uPointerNdc; uniform float uLens; uniform float uSpeed;
  varying vec3 vC; varying float vA; varying float vCore;
  void main() {
    vec3 p = position;
    float r = length(p.xz);
    float w = uSpin * (1.0 - smoothstep(0.08 * uR, 0.5 * uR, r));
    float c = cos(w), s = sin(w);
    p.xz = mat2(c, -s, s, c) * p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float px = worldPointSize(aSize * uR * 0.0032, d);
    // the hot core highlight only exists on sprites big enough to sample it on several pixels
    vCore = smoothstep(5.0, 9.0, px);
    float tw = 0.78 + 0.22 * sin(uTime * (0.4 + aSeed * 2.2) + aSeed * 60.0);
    vA = 1.35 * uGlow * tw * smoothstep(500.0, 3500.0, d) * (1.0 + uSpeed * 0.6);
    gl_PointSize = min(stablePoint(px, vA), 3.4 * uDpr);
    gl_Position = projectionMatrix * mv;
    // gravitational lensing around the pointer (screen space, cheap)
    vec2 ndc = gl_Position.xy / gl_Position.w;
    vec2 dd = ndc - uPointerNdc;
    float l = uLens * exp(-dot(dd, dd) * 16.0) * 0.03;
    gl_Position.xy += normalize(dd + 1e-5) * l * gl_Position.w;
    vC = aColor;
  }
`
const starFrag = /* glsl */ `
  varying vec3 vC; varying float vA; varying float vCore;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = (a * a + smoothstep(0.12, 0.0, d) * vCore) * vA;
    gl_FragColor = vec4(vC * a, a);
    #include <colorspace_fragment>
  }
`
const cloudVert = /* glsl */ `
  ${POINT_GLSL}
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uGlow; uniform float uSpin; uniform float uR;
  varying vec3 vC; varying float vA;
  void main() {
    vec3 p = position;
    float r = length(p.xz);
    float w = uSpin * (1.0 - smoothstep(0.08 * uR, 0.5 * uR, r));
    float c = cos(w), s = sin(w);
    p.xz = mat2(c, -s, s, c) * p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    float px = worldPointSize(aSize, d);
    // never let a cloud fill the screen when we fly through it
    vA = uGlow * smoothstep(aSize * 0.35, aSize * 1.6, d);
    gl_PointSize = min(px, 900.0);
    gl_Position = projectionMatrix * mv;
    vC = aColor;
  }
`
const glowFrag = /* glsl */ `
  uniform float uStrength;
  varying vec3 vC; varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = exp(-dot(c, c) * 14.0) * vA * uStrength;
    gl_FragColor = vec4(vC * a, a);
    #include <colorspace_fragment>
  }
`
const dustFrag = /* glsl */ `
  varying vec3 vC; varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    // dust lanes: darker and denser, so the arms get real contrast
    float a = exp(-dot(c, c) * 9.0) * vA * 0.82;
    gl_FragColor = vec4(0.006, 0.006, 0.02, a);
  }
`
const coreVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const coreFrag = /* glsl */ `
  uniform float uGlow; uniform float uTime; uniform float uChart;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float glow = exp(-r * r * 44.0) * 0.95 + exp(-r * r * 9.0) * 0.3;
    // a thin anamorphic streak: the one lens flare in the universe
    float streak = exp(-abs(vUv.y) * 260.0) * exp(-abs(vUv.x) * 5.0) * 0.35;
    vec3 col = mix(vec3(1.0, 0.72, 0.46), vec3(1.0, 0.93, 0.82), exp(-r * 30.0));
    float a = (glow + streak) * uGlow * (1.0 + uChart * 0.7);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`

export function Galaxy() {
  const tier = useWorld((s) => s.bootTier)
  const q = QUALITY[tier]
  const core = useRef<THREE.Mesh>(null)
  const spin = useMemo(() => ({ value: 0 }), [])
  const uLens = useMemo(() => ({ value: 0 }), [])
  const uSpeed = useMemo(() => ({ value: 0 }), [])
  const uR = useMemo(() => ({ value: GALAXY_R }), [])

  const stars = useMemo(() => {
    const g = makeGalaxyStars(q.galaxy)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(g.pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(g.col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(g.size, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(g.seed, 1))
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GALAXY_R * 1.3)
    const mat = new THREE.ShaderMaterial({
      vertexShader: starVert,
      fragmentShader: starFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.uTime, uGlow: U.uGlow, uSpin: spin, uR, uProj: U.uProj, uDpr: U.uDpr, uPointerNdc: U.uPointerNdc, uLens, uSpeed },
    })
    return { geo, mat }
  }, [q.galaxy, spin, uLens, uSpeed, uR])

  const clouds = useMemo(() => {
    const nGlow = Math.round(q.galaxy / 220)
    const nDust = Math.round(q.galaxy / 180)
    const c = makeGalaxyClouds(nGlow, nDust)
    const glowGeo = new THREE.BufferGeometry()
    glowGeo.setAttribute('position', new THREE.BufferAttribute(c.glow.pos, 3))
    glowGeo.setAttribute('aColor', new THREE.BufferAttribute(c.glow.col, 3))
    glowGeo.setAttribute('aSize', new THREE.BufferAttribute(c.glow.size, 1))
    glowGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GALAXY_R * 1.3)
    const dustGeo = new THREE.BufferGeometry()
    dustGeo.setAttribute('position', new THREE.BufferAttribute(c.dust.pos, 3))
    dustGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(c.dust.size.length * 3), 3))
    dustGeo.setAttribute('aSize', new THREE.BufferAttribute(c.dust.size, 1))
    dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GALAXY_R * 1.3)
    const common = { uGlow: U.uGlow, uSpin: spin, uR, uProj: U.uProj, uDpr: U.uDpr }
    const glowMat = new THREE.ShaderMaterial({ vertexShader: cloudVert, fragmentShader: glowFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...common, uStrength: { value: 0.26 } } })
    const dustMat = new THREE.ShaderMaterial({ vertexShader: cloudVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, blending: THREE.NormalBlending, uniforms: common })
    return { glowGeo, glowMat, dustGeo, dustMat }
  }, [q.galaxy, spin, uR])

  const coreMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: coreVert, fragmentShader: coreFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uGlow: U.uGlow, uTime: U.uTime, uChart: U.uChart } }),
    [],
  )

  useFrame(({ camera }) => {
    spin.value = S.time * 0.0035
    // the governor's budget: fewer stars drawn, same buffers (stars are generated in random order)
    const n = Math.min(q.galaxy, budget('galaxy'))
    stars.geo.setDrawRange(0, n)
    clouds.glowGeo.setDrawRange(0, Math.round(n / 220))
    clouds.dustGeo.setDrawRange(0, Math.round(n / 180))
    const st = useWorld.getState()
    uLens.value += ((live.pointer.active && live.pointer.overWorld && !st.coarse ? 1 : 0) - uLens.value) * 0.08
    uSpeed.value = live.speed
    // billboard the core in galaxy-local space
    if (core.current) core.current.quaternion.copy(camera.quaternion).premultiply(INV_GALAXY)
  })

  return (
    <group position={GALAXY_CENTRE} quaternion={GALAXY_QUAT}>
      <points geometry={stars.geo} material={stars.mat} frustumCulled={false} renderOrder={-6} />
      <points geometry={clouds.dustGeo} material={clouds.dustMat} frustumCulled={false} renderOrder={-5} />
      <points geometry={clouds.glowGeo} material={clouds.glowMat} frustumCulled={false} renderOrder={-4} />
      <mesh ref={core} material={coreMat} renderOrder={-4} frustumCulled={false}>
        <planeGeometry args={[GALAXY_R * 0.55, GALAXY_R * 0.55]} />
      </mesh>
    </group>
  )
}
