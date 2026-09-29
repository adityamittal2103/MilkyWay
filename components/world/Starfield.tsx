'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { live, useWorld } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { S, U, budget } from './system'

/**
 * Two layers:
 *  - NearStars: instanced quads in a box that wraps around the camera. Each quad is built in
 *    clip space between the star's position now and where it was (relative to the moving camera),
 *    so streak length is real motion blur: gentle drift at rest, full streaks at warp.
 *  - FarStars: a static shell of faint points for depth.
 */
const BOX = 1400
// parallax layers are quantised to 1/8 steps, so the warp travel can be wrapped on the CPU (in
// double precision) by 16·BOX without moving any star: shader values stay small forever
const PAR_STEPS = 8
const WRAP = BOX * 2 * PAR_STEPS

const nearVert = /* glsl */ `
  attribute vec3 aPos;
  attribute vec4 aData; // parallax, size, temperature, phase
  uniform vec3 uCam;
  uniform vec3 uShift; // (camera + warp travel) wrapped by WRAP
  uniform vec3 uVel;
  uniform float uStreak;
  uniform vec2 uRes;
  uniform float uDpr;
  uniform float uTime;
  uniform vec2 uPointerNdc;
  uniform float uLens;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vTemp;
  varying float vStretch;
  void main() {
    vUv = vec2(0.0); vTemp = 0.0; vStretch = 0.0;
    float par = aData.x;
    vec3 rel = mod(aPos - uShift * par + ${BOX.toFixed(1)}, ${(BOX * 2).toFixed(1)}) - ${BOX.toFixed(1)};
    vec3 head = uCam + rel;
    vec3 tail = head + uVel * par * uStreak;
    vec4 h = projectionMatrix * viewMatrix * vec4(head, 1.0);
    if (h.w < 2.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); vAlpha = 0.0; return; } // behind us: cull
    vec4 t = projectionMatrix * viewMatrix * vec4(tail, 1.0);
    if (t.w < 2.0) t = h; // tail crosses the camera plane: collapse to a point
    vec2 hs = h.xy / h.w;
    vec2 ts = t.xy / t.w;
    // gravitational lensing around the pointer: stars slide away from it
    vec2 d = hs - uPointerNdc; d.x *= uRes.x / uRes.y;
    float lens = uLens * exp(-dot(d, d) * 14.0) * 0.06;
    vec2 push = normalize(d + 1e-5) * lens; push.x *= uRes.y / uRes.x;
    hs += push; ts += push;
    vec2 dir = (hs - ts) * uRes;
    float len = length(dir);
    vec2 ax = len > 0.5 ? dir / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-ax.y, ax.x);
    float dist = length(rel);
    float w = aData.y * uDpr * clamp(420.0 / max(h.w, 1.0), 0.6, 2.2);
    // a quad thinner than ~1.5 px snaps between pixels (shimmer): keep it drawable, fade instead
    float cover = 1.0;
    float wMin = 1.5; // half-width in physical px: a quad under ~3 px wide snaps between pixels
    if (w < wMin) { cover = pow(w / wMin, 1.5); w = wMin; }
    // quad: position.x ∈ {0,1} along the streak, position.y ∈ {-1,1} across it
    vec2 base = mix(ts, hs, position.x) * uRes;
    base += ax * (position.x * 2.0 - 1.0) * w + nrm * position.y * w;
    gl_Position = vec4(base / uRes * h.w, h.z, h.w);
    vUv = vec2(position.x, position.y);
    vStretch = len / (len + w * 2.0);
    float twinkle = 0.75 + 0.25 * sin(uTime * (1.0 + aData.w * 3.0) + aData.w * 40.0);
    vAlpha = (1.0 - smoothstep(${(BOX * 0.72).toFixed(1)}, ${BOX.toFixed(1)}, dist)) * smoothstep(8.0, 60.0, dist) * twinkle * cover;
    vTemp = aData.z;
  }
`
const nearFrag = /* glsl */ `
  uniform vec3 uCold;
  uniform vec3 uWarm;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vAlpha;
  varying float vTemp;
  varying float vStretch;
  void main() {
    float across = 1.0 - abs(vUv.y);
    across = pow(across, 1.6);
    float along = mix(1.0, vUv.x, vStretch);         // streak fades toward its tail
    float tip = 1.0 - smoothstep(0.0, 1.0, abs(vUv.x * 2.0 - 1.0) * (1.0 - vStretch)); // round dot at rest
    float a = across * along * mix(tip, 1.0, vStretch) * vAlpha * uOpacity;
    vec3 c = mix(uCold, uWarm, vTemp);
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`

function NearStars({ count }: { count: number }) {
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const geo = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    const pos = new Float32Array(count * 3)
    const data = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * BOX
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * BOX
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * BOX
      data[i * 4] = Math.max(2, Math.round((0.25 + Math.pow(Math.random(), 1.5) * 0.75) * PAR_STEPS)) / PAR_STEPS // parallax layer (quantised)
      data[i * 4 + 1] = 0.55 + Math.pow(Math.random(), 6) * 2.4 // a few bright ones
      data[i * 4 + 2] = Math.random() < 0.12 ? 0.7 + Math.random() * 0.3 : Math.random() * 0.25
      data[i * 4 + 3] = Math.random()
    }
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 3))
    g.setAttribute('aData', new THREE.InstancedBufferAttribute(data, 4))
    g.instanceCount = count
    return g
  }, [count])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: nearVert,
        fragmentShader: nearFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uCam: { value: new THREE.Vector3() },
          uShift: { value: new THREE.Vector3() },
          uVel: { value: new THREE.Vector3() },
          uStreak: { value: 0.06 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uDpr: { value: 1 },
          uTime: U.uTime,
          uPointerNdc: { value: new THREE.Vector2() },
          uLens: { value: 0 },
          uCold: { value: new THREE.Color('#DCE6FF') },
          uWarm: { value: new THREE.Color('#FFD2A8') },
          uOpacity: { value: 1 },
        },
      }),
    [],
  )

  const prev = useRef(new THREE.Vector3())
  const travel = useRef(new THREE.Vector3())
  const vel = useRef(new THREE.Vector3())
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const tmpV = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const u = mat.uniforms
    // camera velocity (world units / s), smoothed
    const v = tmpV.copy(camera.position).sub(prev.current).divideScalar(Math.max(dt, 1e-3))
    prev.current.copy(camera.position)
    vel.current.lerp(v, 1 - Math.exp(-8 * dt))
    // warp: fly the star box toward the camera along the view direction
    camera.getWorldDirection(fwd)
    const warpSpeed = (S.warp + S.hyper * 0.7 + S.flight * 0.35) * 5200 + live.speed * 260
    travel.current.addScaledVector(fwd, warpSpeed * dt)
    const t = travel.current
    const w = (x: number) => x - Math.floor(x / WRAP) * WRAP
    t.set(w(t.x), w(t.y), w(t.z))
    u.uCam.value.copy(camera.position)
    u.uShift.value.set(w(camera.position.x + t.x), w(camera.position.y + t.y), w(camera.position.z + t.z))
    geo.instanceCount = Math.min(count, budget('stars'))
    // streak vector = where the star "came from" relative to us
    u.uVel.value.copy(vel.current).multiplyScalar(-1).addScaledVector(fwd, -warpSpeed)
    u.uStreak.value = 0.045
    u.uRes.value.set(size.width, size.height)
    u.uDpr.value = dpr
    u.uPointerNdc.value.set(live.pointer.x, live.pointer.y)
    const st = useWorld.getState()
    u.uLens.value = live.pointer.active && !st.coarse ? 1 : 0
    u.uOpacity.value = (0.5 + 0.5 * Math.max(S.galaxy, S.warp, S.hyper, 0.3)) * (1 + U.uFlash.value * 0.9)
  })

  return <mesh geometry={geo} material={mat} frustumCulled={false} renderOrder={-2} />
}

const farVert = /* glsl */ `
  attribute vec2 aData;
  uniform float uTime;
  uniform float uDpr;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = (0.8 + aData.x * 1.8) * uDpr;
    vA = (0.35 + 0.65 * aData.x) * (0.7 + 0.3 * sin(uTime * 0.6 + aData.y * 50.0));
    // never below ~1.6 px: sub-pixel stars hop between pixels as the view turns
    float m = 3.0; // physical px: below this a point's coverage (1–4 px) jumps as it moves
    if (px < m) { vA *= pow(px / m, 1.5); px = m; }
    gl_PointSize = px;
  }
`
const farFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(c)) * vA * uOpacity;
    gl_FragColor = vec4(vec3(0.86, 0.9, 1.0) * a, a);
    #include <colorspace_fragment>
  }
`

function FarStars({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr)
  const ref = useRef<THREE.Points>(null)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(count * 3)
    const d = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1
      const th = Math.random() * Math.PI * 2
      const r = 14000
      const s = Math.sqrt(1 - u * u)
      p[i * 3] = r * s * Math.cos(th)
      p[i * 3 + 1] = r * u
      p[i * 3 + 2] = r * s * Math.sin(th)
      d[i * 2] = Math.pow(Math.random(), 4)
      d[i * 2 + 1] = Math.random()
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('aData', new THREE.BufferAttribute(d, 2))
    return g
  }, [count])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: farVert,
        fragmentShader: farFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: U.uTime, uDpr: { value: 1 }, uOpacity: { value: 1 } },
      }),
    [],
  )
  useFrame(({ camera }) => {
    // shell follows the camera: infinitely far, no parallax
    ref.current?.position.copy(camera.position)
    mat.uniforms.uDpr.value = dpr
    mat.uniforms.uOpacity.value = 0.55 + 0.45 * Math.max(S.galaxy, 0.2)
    geo.setDrawRange(0, Math.min(count, Math.round(budget('stars') * 0.6)))
  })
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={-3} />
}

export function Starfield() {
  const tier = useWorld((s) => s.bootTier)
  const q = QUALITY[tier]
  return (
    <>
      <FarStars count={Math.round(q.stars * 0.6)} />
      <NearStars count={q.stars} />
    </>
  )
}
