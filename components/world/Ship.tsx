'use client'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { live, useWorld } from '@/lib/store'
import { BREAKPOINT } from '@/lib/constants'
import { S, U, damp } from './system'
import { journeyShip, JOURNEY_UNITS } from '@/lib/director'

/**
 * JUGAAD-1 (hull MW-01): a student-built interdimensional festival craft.
 * Deliberately asymmetric: canopy offset to port, one big salvaged thruster to starboard and a
 * small one to port, a dish on the spine, a whip antenna on a spring, mismatched fins.
 * Local axes: nose → −Z, up → +Y, starboard → +X. ~2.4 units long.
 *
 * It lives in camera space (a chase-cam) so it is always "your" vehicle, and it performs the
 * cold-open choreography (approach → drift-flip → anticipation → boost).
 */

/* ───────────── decal textures (drawn once) */
function decalTexture() {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#F1EDE4'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#FF7A1A'
  g.fillRect(0, 0, 512, 16)
  g.fillStyle = '#141A33'
  g.font = '700 64px "IBM Plex Mono", ui-monospace, monospace'
  g.fillText('MW-01', 22, 92)
  g.font = '500 22px "IBM Plex Mono", ui-monospace, monospace'
  g.fillText('JUGAAD-1 · DEEP SPACE', 250, 64)
  g.fillText('HANDLE WITH VIBES', 250, 96)
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#141A33' : '#F1EDE4'
    g.fillRect(470 + (i % 2) * 20, 104 + Math.floor(i / 2) * 6, 20, 6)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function stickerTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#FF3E9A'
  g.beginPath()
  g.arc(128, 128, 124, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#F1EDE4'
  g.lineWidth = 10
  g.beginPath()
  g.moveTo(40, 128)
  g.lineTo(216, 128)
  g.stroke()
  g.fillStyle = '#F1EDE4'
  g.font = '800 96px "Anybody", system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText('M', 128, 116)
  g.save()
  g.scale(1, -1)
  g.fillText('M', 128, -140) // the mirror: W
  g.restore()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ───────────── exhaust: additive flame with flicker */
const flameVert = /* glsl */ `
  varying vec2 vUv;
  varying float vY;
  uniform float uPower;
  uniform float uTime;
  void main() {
    vUv = uv;
    vec3 p = position;
    vY = uv.y;
    float wob = (sin(uTime * 17.0 + p.y * 9.0) * 0.6 + sin(uTime * 9.3 + p.y * 5.0) * 0.4) * 0.03 * (1.0 - uv.y);
    p.x += wob; p.z += wob * 0.6;
    p.y *= 0.4 + uPower * 1.6;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const flameFrag = /* glsl */ `
  uniform vec3 uCore;
  uniform vec3 uHot;
  uniform vec3 uTip;
  uniform float uPower;
  uniform float uTime;
  varying vec2 vUv;
  varying float vY;
  void main() {
    float t = vY; // 1 at nozzle, 0 at tip (cone geometry)
    vec3 c = mix(uTip, uHot, smoothstep(0.0, 0.6, t));
    c = mix(c, uCore, smoothstep(0.75, 1.0, t));
    // flame life: slow layered motion, never a strobe (fast brightness flicker blooms into a flash)
    float flick = 0.9 + 0.1 * sin(uTime * 13.0 + vUv.x * 6.0 + vY * 4.0) * sin(uTime * 7.3 + vUv.x * 3.0);
    float a = smoothstep(0.0, 0.5, t) * flick * (0.25 + uPower);
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`

function Flame({ radius, length, power }: { radius: number; length: number; power: React.MutableRefObject<number> }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flameVert,
        fragmentShader: flameFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: {
          uCore: { value: new THREE.Color('#FFF4E0') },
          uHot: { value: new THREE.Color('#FF7A1A') },
          uTip: { value: new THREE.Color('#FF3E9A') },
          uPower: { value: 0.4 },
          uTime: { value: 0 },
        },
      }),
    [],
  )
  const geo = useMemo(() => {
    // cone pointing −Y with the base at y=0 → rotate so it trails behind (+Z)
    const g = new THREE.ConeGeometry(radius, length, 20, 6, true)
    g.translate(0, -length / 2, 0)
    g.rotateX(-Math.PI / 2)
    g.rotateX(Math.PI) // base at nozzle, tip toward +Z
    return g
  }, [radius, length])
  useFrame(() => {
    mat.uniforms.uTime.value = S.time
    mat.uniforms.uPower.value = power.current
  })
  return <mesh geometry={geo} material={mat} renderOrder={5} />
}

/* ───────────── engine trail: sparks streaming aft, rate + length follow thrust */
const sparkVert = /* glsl */ `
  attribute vec3 aSeed;
  uniform float uTime; uniform float uPower; uniform float uSpread; uniform float uDpr;
  varying float vA;
  void main() {
    float life = fract(uTime * (0.9 + aSeed.x) + aSeed.y);
    float len = 1.2 + uPower * 5.0;
    vec3 p = vec3((aSeed.x - 0.5) * uSpread * (0.4 + life), (aSeed.z - 0.5) * uSpread * (0.4 + life), life * len);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.0 + (1.0 - life) * 2.5) * uDpr;
    vA = (1.0 - life) * (0.25 + uPower * 0.8);
  }
`
const sparkFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * a, a);
    #include <colorspace_fragment>
  }
`
function Sparks({ power, spread }: { power: React.MutableRefObject<number>; spread: number }) {
  const { geo, mat } = useMemo(() => {
    const n = 90
    const seed = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) seed.set([Math.random(), Math.random(), Math.random()], i * 3)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const m = new THREE.ShaderMaterial({
      vertexShader: sparkVert,
      fragmentShader: sparkFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPower: { value: 0.4 }, uSpread: { value: spread }, uDpr: U.uDpr },
    })
    return { geo: g, mat: m }
  }, [spread])
  useFrame(() => {
    mat.uniforms.uTime.value = S.time
    mat.uniforms.uPower.value = power.current
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}

/* ───────────── glow sprite (engine halo, visible from the front during the approach) */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  gr.addColorStop(0, 'rgba(255,214,170,0.9)')
  gr.addColorStop(0.12, 'rgba(255,140,60,0.55)')
  gr.addColorStop(0.45, 'rgba(255,90,40,0.12)')
  gr.addColorStop(1, 'rgba(255,60,150,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ───────────── the craft */
function Hull({ power, antenna, legsDown }: { power: React.MutableRefObject<number>; antenna: React.MutableRefObject<THREE.Group | null>; legsDown: React.MutableRefObject<number> }) {
  const ringDrive = useRef<THREE.Group>(null)
  const core = useRef<THREE.Mesh>(null)
  const legs = useRef<THREE.Group>(null)
  const dish = useRef<THREE.Group>(null)
  const mats = useMemo(() => {
    const hull = new THREE.MeshStandardMaterial({ color: '#D9D3C6', roughness: 0.5, metalness: 0.12 })
    const stripe = new THREE.MeshStandardMaterial({ color: '#FF7A1A', roughness: 0.5, emissive: '#FF5A0A', emissiveIntensity: 0.25 })
    const panel = new THREE.MeshStandardMaterial({ color: '#1B2242', roughness: 0.55, metalness: 0.6 })
    const metal = new THREE.MeshStandardMaterial({ color: '#8A90A8', roughness: 0.3, metalness: 0.85 })
    const canopy = new THREE.MeshStandardMaterial({ color: '#5B8CFF', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.42, emissive: '#1B3A99', emissiveIntensity: 0.4 })
    const nozzleGlow = new THREE.MeshBasicMaterial({ color: '#FF8A3A' })
    const decal = new THREE.MeshStandardMaterial({ map: decalTexture(), roughness: 0.5, transparent: true })
    const sticker = new THREE.MeshStandardMaterial({ map: stickerTexture(), roughness: 0.6, transparent: true })
    const red = new THREE.MeshBasicMaterial({ color: '#FF2A3D' })
    const green = new THREE.MeshBasicMaterial({ color: '#2DFF8E' })
    const white = new THREE.MeshBasicMaterial({ color: '#FFFFFF' })
    const pilot = new THREE.MeshBasicMaterial({ color: '#FF7A1A' })
    const membrane = new THREE.MeshBasicMaterial({ color: '#FF8A3A', transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    const core = new THREE.MeshBasicMaterial({ color: '#5BE1FF' })
    return { hull, stripe, panel, metal, canopy, nozzleGlow, decal, sticker, red, green, white, pilot, membrane, core }
  }, [])

  const hullGeo = useMemo(() => {
    // egg profile, lathed around Y then laid along Z (nose → −Z)
    const pts: THREE.Vector2[] = []
    const prof: [number, number][] = [
      [0.0, -1.12], [0.26, -1.1], [0.42, -0.95], [0.52, -0.6], [0.56, -0.2], [0.54, 0.2], [0.47, 0.55], [0.34, 0.85], [0.17, 1.05], [0.0, 1.12],
    ]
    for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y))
    const g = new THREE.LatheGeometry(pts, 32)
    g.rotateX(-Math.PI / 2) // +Y (nose) → −Z
    g.scale(1, 0.82, 1) // squashed: a pebble, not a bullet
    return g
  }, [])

  const finGeo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(0, 0)
    s.lineTo(0.62, -0.12)
    s.lineTo(0.7, -0.5)
    s.lineTo(0.18, -0.52)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 })
    g.rotateY(Math.PI / 2)
    return g
  }, [])

  const glow = useMemo(() => glowTexture(), [])
  const blink = useRef<THREE.Group>(null)

  useFrame(() => {
    const t = S.time
    // nav lights pulse, the tail strobe double-flashes: all smooth envelopes (hard on/off = flicker)
    const on = (x: number) => Math.pow(Math.max(0, Math.sin(t * x)), 4)
    if (blink.current) {
      const [r, g, w] = blink.current.children as THREE.Mesh[]
      r.scale.setScalar(0.6 + on(3.1) * 0.6)
      g.scale.setScalar(0.6 + on(3.1) * 0.6)
      const ph = (t * 0.85) % 1
      const flash = Math.exp(-Math.pow((ph - 0.1) / 0.025, 2)) + 0.7 * Math.exp(-Math.pow((ph - 0.22) / 0.025, 2))
      w.scale.setScalar(0.2 + flash * 1.4)
    }
    mats.nozzleGlow.color.setRGB(1, 0.42 + power.current * 0.25, 0.18 + power.current * 0.22)
    // moving parts: the ring drive spins with thrust, the core breathes, the dish scans, legs fold
    if (ringDrive.current) ringDrive.current.rotation.z += 0.004 + power.current * 0.05
    mats.membrane.opacity = 0.25 + power.current * 0.5
    mats.membrane.color.setRGB(1, 0.45 + power.current * 0.3, 0.2 + power.current * 0.3)
    const pulse = 0.6 + 0.4 * Math.sin(t * 3.2)
    mats.core.color.setRGB(0.25 * pulse, 0.75 * pulse + 0.2, 1)
    if (core.current) core.current.scale.setScalar(0.85 + pulse * 0.2)
    if (dish.current) dish.current.rotation.y = Math.sin(t * 0.4) * 0.9
    if (legs.current)
      legs.current.children.forEach((l, i) => {
        l.rotation.x = (1 - legsDown.current) * (i === 2 ? -1.35 : 1.35)
        l.scale.y = 0.35 + legsDown.current * 0.65
      })
  })

  return (
    <group>
      <mesh geometry={hullGeo} material={mats.hull} />
      {/* panel seams + the saffron tail stripe */}
      {[
        { z: -0.62, r: 0.5, m: mats.panel, t: 0.018 },
        { z: 0.08, r: 0.555, m: mats.panel, t: 0.018 },
        { z: 0.62, r: 0.47, m: mats.stripe, t: 0.035 },
      ].map((b) => (
        <mesh key={b.z} position={[0, 0, b.z]} scale={[1, 0.82, 1]} material={b.m}>
          <torusGeometry args={[b.r, b.t, 6, 40]} />
        </mesh>
      ))}
      {/* belly plate */}
      <mesh position={[0, -0.36, 0.05]} material={mats.panel}>
        <boxGeometry args={[0.62, 0.1, 1.3]} />
      </mesh>
      {/* spine */}
      <mesh position={[0.08, 0.44, 0.15]} material={mats.panel}>
        <boxGeometry args={[0.12, 0.08, 1.1]} />
      </mesh>
      {/* canopy, offset to port */}
      <group position={[-0.17, 0.3, -0.42]} rotation={[-0.25, 0, 0.12]}>
        <mesh material={mats.canopy} scale={[1, 0.8, 1.25]}>
          <sphereGeometry args={[0.3, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} material={mats.metal} scale={[1, 1.25, 1]}>
          <torusGeometry args={[0.3, 0.022, 8, 32]} />
        </mesh>
        {/* pilot light inside the bubble */}
        <mesh position={[0, 0.06, 0.04]} material={mats.pilot}>
          <sphereGeometry args={[0.035, 8, 8]} />
        </mesh>
      </group>

      {/* starboard: the RING DRIVE, a hoop engine with a glowing energy membrane. The silhouette. */}
      <group position={[0.7, -0.04, 0.5]}>
        <group ref={ringDrive}>
          <mesh material={mats.hull}>
            <torusGeometry args={[0.44, 0.095, 12, 40]} />
          </mesh>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <mesh key={i} rotation-z={(i / 6) * Math.PI * 2} position={[Math.cos((i / 6) * Math.PI * 2) * 0.44, Math.sin((i / 6) * Math.PI * 2) * 0.44, 0]} material={mats.panel}>
              <boxGeometry args={[0.06, 0.24, 0.24]} />
            </mesh>
          ))}
        </group>
        <mesh material={mats.membrane}>
          <circleGeometry args={[0.36, 40]} />
        </mesh>
        <mesh material={mats.metal} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.06, 0.06, 0.5, 8]} />
        </mesh>
        <group position={[0, 0, 0.12]}>
          <Flame radius={0.3} length={1.6} power={power} />
        </group>
        <mesh position={[0.46, 0.28, 0.0]} rotation-y={Math.PI / 2} material={mats.sticker}>
          <circleGeometry args={[0.12, 24]} />
        </mesh>
        <sprite scale={[1.0, 1.0, 1]} position={[0, 0, 0.5]}>
          <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} />
        </sprite>
        <Sparks power={power} spread={0.3} />
      </group>
      {/* strut */}
      <mesh position={[0.4, -0.08, 0.45]} rotation-z={-0.15} material={mats.metal}>
        <boxGeometry args={[0.36, 0.06, 0.28]} />
      </mesh>

      {/* port: small thruster */}
      <group position={[-0.52, 0.02, 0.62]}>
        <mesh rotation-x={Math.PI / 2} material={mats.panel}>
          <cylinderGeometry args={[0.13, 0.15, 0.62, 16]} />
        </mesh>
        <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.36]} material={mats.metal}>
          <cylinderGeometry args={[0.19, 0.15, 0.12, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0, 0.4]} material={mats.nozzleGlow}>
          <circleGeometry args={[0.14, 16]} />
        </mesh>
        <group position={[0, 0, 0.41]}>
          <Flame radius={0.14} length={0.9} power={power} />
        </group>
        <sprite scale={[0.6, 0.6, 1]} position={[0, 0, 0.6]}>
          <spriteMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.5} />
        </sprite>
      </group>
      <mesh position={[-0.42, 0.0, 0.5]} rotation-z={0.2} material={mats.metal}>
        <boxGeometry args={[0.2, 0.05, 0.2]} />
      </mesh>

      {/* the energy source: a pulsing core seen through a port-side window */}
      <group position={[-0.5, -0.04, -0.12]} rotation-y={-Math.PI / 2}>
        <mesh material={mats.metal}>
          <torusGeometry args={[0.12, 0.022, 8, 24]} />
        </mesh>
        <mesh ref={core} material={mats.core}>
          <circleGeometry args={[0.11, 24]} />
        </mesh>
      </group>

      {/* landing legs: fold down when touching down, tuck away in flight */}
      <group ref={legs}>
        {[
          [-0.3, -0.36, -0.55],
          [0.3, -0.36, -0.55],
          [0.0, -0.4, 0.55],
        ].map((p, i) => (
          <group key={i} position={p as [number, number, number]}>
            <mesh position={[0, -0.2, 0]} material={mats.metal}>
              <cylinderGeometry args={[0.018, 0.024, 0.4, 6]} />
            </mesh>
            <mesh position={[0, -0.41, 0]} material={mats.panel}>
              <cylinderGeometry args={[0.07, 0.08, 0.025, 10]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* fins, mismatched */}
      <mesh geometry={finGeo} position={[0.66, 0.2, 0.9]} material={mats.hull} />
      <mesh geometry={finGeo} position={[-0.5, 0.12, 0.85]} rotation-z={0.5} scale={0.62} material={mats.panel} />

      {/* dorsal dish ("for the aux cable") */}
      <group ref={dish} position={[0.2, 0.52, 0.35]} rotation={[0.9, 0.4, 0]}>
        <mesh material={mats.metal}>
          <cylinderGeometry args={[0.016, 0.016, 0.2, 6]} />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation-x={Math.PI} material={mats.hull}>
          <sphereGeometry args={[0.2, 20, 8, 0, Math.PI * 2, 0, 0.9]} />
        </mesh>
        <mesh position={[0, 0.2, 0]} material={mats.metal}>
          <sphereGeometry args={[0.02, 6, 6]} />
        </mesh>
      </group>

      {/* whip antenna on a spring (two segments) */}
      <group ref={antenna} position={[-0.3, 0.36, 0.5]}>
        <mesh position={[0, 0.3, 0]} material={mats.metal}>
          <cylinderGeometry args={[0.013, 0.016, 0.6, 5]} />
        </mesh>
        <group position={[0, 0.6, 0]}>
          <mesh position={[0, 0.25, 0]} material={mats.metal}>
            <cylinderGeometry args={[0.011, 0.013, 0.5, 5]} />
          </mesh>
          <mesh position={[0, 0.52, 0]} material={mats.red}>
            <sphereGeometry args={[0.025, 8, 8]} />
          </mesh>
        </group>
      </group>

      {/* orbital halo ring around the nose */}
      <mesh position={[0, 0.02, -0.55]} rotation={[0.2, 0, 0.35]} material={mats.metal}>
        <torusGeometry args={[0.62, 0.018, 6, 64]} />
      </mesh>

      {/* hull decal (starboard side) */}
      <mesh position={[0.535, 0.02, -0.15]} rotation-y={Math.PI / 2} material={mats.decal}>
        <planeGeometry args={[0.8, 0.2]} />
      </mesh>

      {/* nav lights: port red, starboard green, tail strobe */}
      <group ref={blink}>
        <mesh position={[-0.62, 0.02, 0.2]} material={mats.red}>
          <sphereGeometry args={[0.03, 8, 8]} />
        </mesh>
        <mesh position={[0.92, 0.02, 0.2]} material={mats.green}>
          <sphereGeometry args={[0.03, 8, 8]} />
        </mesh>
        <mesh position={[0.1, 0.46, 0.85]} material={mats.white}>
          <sphereGeometry args={[0.03, 8, 8]} />
        </mesh>
      </group>
    </group>
  )
}

/* ───────────── choreography */
const ease = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))
const seg = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))

export function Ship() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const antenna = useRef<THREE.Group | null>(null)
  const power = useRef(0.4)
  const off = useRef(new THREE.Vector3(0, -0.55, -7))
  const bank = useRef({ roll: 0, pitch: 0, yaw: 0, vr: 0, vp: 0 })
  const spring = useRef({ x: 0, z: 0, vx: 0, vz: 0 })
  const trick = useRef({ t: 1, from: 0 })
  const prevCam = useRef(new THREE.Vector3())
  const camVelLocal = useMemo(() => new THREE.Vector3(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const shipTricks = useWorld((s) => s.shipTricks)
  const hovered = useRef(false)
  const legsDown = useRef(0)

  useEffect(() => {
    if (shipTricks > 0) {
      trick.current = { t: 0, from: 0 }
      spring.current.vx += 9
      spring.current.vz -= 6
    }
  }, [shipTricks])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const r = root.current
    const b = body.current
    if (!r || !b) return
    const st = useWorld.getState()
    const mobile = size.width < BREAKPOINT.mobile
    const portrait = size.width / size.height < 0.9
    const time = S.time

    // ── where the ship sits in camera space, per mode (deliberate per layout, never over copy)
    let target: [number, number, number]
    let yaw = 0
    let scale = 1
    const venueLevel = st.nav.kind === 'venue' || st.nav.kind === 'zone' || st.nav.kind === 'event'
    if (st.mode === 'home') target = st.introDone ? journeyShip(live.journey * JOURNEY_UNITS, portrait) : portrait ? [0, -0.1, -10] : [0, -0.35, -8]
    else if (st.mode === 'explore') target = portrait ? [0, -2.4, -12] : [0, -1.3, -8.4]
    else if (st.mode === 'register') target = portrait ? [0, 2.4, -12] : [2.6, 1.05, -8.5]
    else if (st.mode === 'venue') target = portrait ? [0, 2.6, -13] : [0.1, -2.05, -10.5]
    else if (st.mode === 'schedule' || st.mode === 'events' || st.mode === 'competitions') target = portrait ? [0, 2.8, -13] : [2.9, -1.6, -9]
    else if (st.mode === 'artists' && st.transmission) target = portrait ? [2.9, -5.2, -15] : [6.3, -2.9, -12.5] // parked at the edge: the signal is the subject
    else if (st.mode === 'artists') target = portrait ? [1.2, -8.5, -15] : [4.6, 1.9, -11.5] // desktop: above the network; phones: out of frame (no free corner)
    else target = portrait ? [1.4, -3.4, -13] : [3.2, -1.8, -9.4]
    if (st.mode === 'register') yaw = -0.9 + S.dock * 0.3 // show the profile at the dock
    if (st.mode !== 'home' && st.mode !== 'register' && st.mode !== 'explore') scale = st.mode === 'artists' ? 0.55 : 0.8
    // narrow screens: a smaller craft, so the ship frames the copy instead of eclipsing it
    if (portrait) scale *= mobile ? 0.55 : 0.75

    // landing legs: down when parked on the hall (landing chapter, venue level, dock); up in flight
    const u = live.journey * 9
    const parked =
      (st.mode === 'home' && st.introDone && u > 5.7 && u < 8.6) ||
      (st.mode === 'explore' && venueLevel) ||
      st.mode === 'venue' ||
      st.mode === 'register'
    legsDown.current = damp(legsDown.current, parked && live.flight < 0.3 ? 1 : 0, 3, dt)

    // explore: the nose leans toward whatever is under the reticle (the flight computer locks on)
    if (st.mode === 'explore' && live.hoverKind && !st.coarse) yaw += -live.pointer.x * 0.35

    // piloting: the craft leads the camera a little in the direction of travel (a chase-cam with
    // mass), then the camera catches up and it settles back
    const pl = live.pilot
    const piloting = live.camState === 'user' || live.camState === 'idle'
    if (piloting) target = [target[0] + pl.r * 0.45, target[1] + pl.u * 0.3, target[2] - pl.f * 0.9]

    // ── cold open choreography (camera-space keyframes)
    let introYaw = 0
    let introRoll = 0
    const it = st.mode === 'home' && !st.introDone ? live.intro : 1
    if (it < 1) {
      const a = ease(seg(it, 0.0, 0.4)) // approach, facing us
      const f = ease(seg(it, 0.38, 0.54)) // drift-flip
      const dip = seg(it, 0.54, 0.64) // anticipation
      const boost = seg(it, 0.64, 0.82)
      const far = new THREE.Vector3(9, 5, -900)
      const near = new THREE.Vector3(0.9, 0.1, -10)
      tmp.lerpVectors(far, near, 1 - Math.pow(1 - a, 3))
      tmp.lerp(new THREE.Vector3(target[0], target[1], target[2]), f)
      tmp.y -= Math.sin(dip * Math.PI) * 0.35
      tmp.z -= Math.sin(boost * Math.PI) * 3.5
      off.current.copy(tmp)
      introYaw = Math.PI * (1 - f)
      introRoll = Math.sin(f * Math.PI) * 1.2
      power.current = 0.35 + dip * 0.4 + Math.sin(boost * Math.PI) * 1.6
    } else {
      off.current.set(damp(off.current.x, target[0], 2.5, dt), damp(off.current.y, target[1], 2.5, dt), damp(off.current.z, target[2], 2.5, dt))
      // engine: idles low, answers throttle (piloting), scroll speed, flights and warp
      const want = 0.32 + live.speed * 0.9 + S.warp * 1.4 + pl.speed * 0.75 + (live.input.boost && pl.speed > 0.2 ? 0.5 : 0) + (hovered.current ? 0.3 : 0)
      power.current = damp(power.current, want, 6, dt)
    }

    if (hovered.current && live.pointer.overWorld) {
      live.hoverKind = 'ship'
      live.hoverLabel = 'MW-01 Jugaad-1'
    }

    // ── attach to camera
    r.position.copy(off.current).applyMatrix4(camera.matrixWorld)
    r.quaternion.copy(camera.quaternion)
    r.scale.setScalar(scale)

    // ── banking from camera motion + pointer
    camVelLocal.copy(camera.position).sub(prevCam.current).divideScalar(Math.max(dt, 1e-3))
    prevCam.current.copy(camera.position)
    camVelLocal.applyQuaternion(q.copy(camera.quaternion).invert())
    const px = st.coarse ? 0 : live.pointer.x
    const py = st.coarse ? 0 : live.pointer.y
    const bk = bank.current
    // attitude targets: when piloting, from the pilot's own velocity (bank into strafes, nose dips
    // into forward thrust, lifts when climbing); otherwise from the camera's motion
    let rollT: number
    let pitchT: number
    let yawT = -px * 0.22 + yaw
    if (piloting) {
      rollT = -pl.r * 0.5 - px * 0.3
      pitchT = -pl.f * 0.16 + pl.u * 0.24 + py * 0.14
      yawT -= pl.r * 0.12
    } else {
      rollT = THREE.MathUtils.clamp(-camVelLocal.x * 0.0009, -0.55, 0.55) - px * 0.3
      pitchT = THREE.MathUtils.clamp(camVelLocal.y * 0.0006, -0.35, 0.35) + py * 0.14
    }
    // a damped spring (ζ ≈ 0.73): heavy, responsive, and a small settle when you let go
    bk.vr += ((rollT - bk.roll) * 34 - bk.vr * 8.5) * dt
    bk.roll += bk.vr * dt
    bk.vp += ((pitchT - bk.pitch) * 34 - bk.vp * 8.5) * dt
    bk.pitch += bk.vp * dt
    bk.yaw = damp(bk.yaw, yawT, 2.5, dt)

    // ── barrel-roll easter egg
    let rollTrick = 0
    if (trick.current.t < 1) {
      trick.current.t = Math.min(1, trick.current.t + dt / 0.95)
      const k = trick.current.t
      rollTrick = (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2) * Math.PI * 2
    }

    const bob = st.reducedMotion ? 0 : Math.sin(time * 1.3) * 0.05
    const view = st.mode === 'register' ? 0 : 1
    e.set(bk.pitch - 0.22 * view + Math.sin(time * 0.7) * 0.02, bk.yaw + introYaw + 0.55 * view, bk.roll + Math.sin(time * 0.9) * 0.03 + introRoll + rollTrick)
    b.rotation.copy(e)
    b.position.y = bob

    // ── antenna spring (underdamped: the one bouncy thing in the universe)
    const sp = spring.current
    const kx = -camVelLocal.x * 0.0006 - (bk.roll - 0) * 0.5
    const kz = camVelLocal.z * 0.0004 + power.current * 0.12
    sp.vx += (-(sp.x - kx) * 60 - sp.vx * 4) * dt
    sp.vz += (-(sp.z - kz) * 60 - sp.vz * 4) * dt
    sp.x += sp.vx * dt
    sp.z += sp.vz * dt
    if (antenna.current) {
      antenna.current.rotation.set(sp.z * 0.8, 0, sp.x)
      const tip = antenna.current.children[1] as THREE.Object3D
      if (tip) tip.rotation.set(sp.z * 1.2, 0, sp.x * 1.4)
    }
  })

  // clicking the ship: barrel roll (WOW 12)
  const onClick = () => {
    if (!live.pointer.overWorld) return
    const st = useWorld.getState()
    st.set({ shipTricks: st.shipTricks + 1 })
    st.discover('ship:roll')
    if (st.shipTricks === 2) st.set({ lore: { title: 'MW-01 · Jugaad-1', body: 'Built from a scooter fuel tank, two salvaged thrusters and one ring drive nobody can fully explain. The antenna is held on with hope. It has never missed a festival.' } })
  }

  return (
    <group ref={root}>
      <group
        ref={body}
        onClick={onClick}
        onPointerOver={() => {
          hovered.current = true
          live.hover3D = true
        }}
        onPointerOut={() => {
          hovered.current = false
          live.hover3D = false
        }}
      >
        <Hull power={power} antenna={antenna} legsDown={legsDown} />
      </group>
      {/* ship lighting: cool key, blue rim, warm engine bounce. Scoped to the ship's scale. */}
      <pointLight position={[0.6, 0, 1.6]} color="#FF7A1A" intensity={3} distance={6} decay={2} />
    </group>
  )
}
