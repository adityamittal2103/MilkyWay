'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { DECK_Y, STATION, platformShape } from '@/lib/universe'
import { setAnchor } from '@/lib/labels'
import { AA_GLSL, S, U } from '../system'
import { circlePoints, glowLineGeometry, glowLineMaterial, glowLines, polylineSegments } from '../vfx/glowLines'

/**
 * Yashobhoomi as a place in space: the hall sits on a floating platform with a tapered keel,
 * lit seams, orbital rings with travelling beacons and two masts. From far away it reads as an
 * abstract station; up close the architecture on top takes over (WOW: "wait, this is Yashobhoomi").
 */
const P = STATION.platform
const FLARE = new THREE.Color('#FF7A1A')

const hullVert = /* glsl */ `
  varying vec3 vWorld; varying vec3 vN;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const hullFrag = /* glsl */ `
  ${AA_GLSL}
  uniform float uFade;
  uniform vec3 uBase; uniform vec3 uSeam; uniform vec3 uAccent; uniform float uTime; uniform float uLit;
  varying vec3 vWorld; varying vec3 vN;
  void main() {
    vec3 n = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float rim = pow(1.0 - abs(dot(n, V)), 3.0);
    float ndl = max(dot(n, normalize(vec3(-0.4, 0.5, -0.6))), 0.0);
    vec3 col = uBase * (0.35 + 0.65 * ndl) + uAccent * rim * 0.35;
    // panel seams on the sides and underside
    float seam = max(aaLine(vWorld.x / 24.0, 0.04), aaLine(vWorld.z / 24.0, 0.04));
    float band = aaLine(vWorld.y / 9.0 + 0.5, 0.12);
    col += uSeam * (seam * 0.12 + band * 0.08 * (1.0 - abs(n.y)));
    // rows of lit windows on the vertical faces
    float win = stripe(vWorld.x / 5.0 + vWorld.z / 5.0, 0.28) * stripe(vWorld.y / 6.0, 0.5) * (1.0 - abs(n.y));
    float flick = step(0.4, fract(sin(floor(vWorld.x / 5.0) * 12.9 + floor(vWorld.z / 5.0) * 7.1) * 43758.5));
    col += vec3(1.0, 0.8, 0.55) * win * flick * 0.55 * uLit;
    gl_FragColor = vec4(col * uFade, 1.0);
    #include <colorspace_fragment>
  }
`
const beaconVert = /* glsl */ `
  attribute float aT; attribute float aRing;
  uniform float uTime; uniform float uDpr; uniform float uProj;
  uniform vec3 uR; uniform vec3 uSpeed;
  varying float vA;
  void main() {
    int i = int(aRing + 0.5);
    float r = i == 0 ? uR.x : i == 1 ? uR.y : uR.z;
    float sp = i == 0 ? uSpeed.x : i == 1 ? uSpeed.y : uSpeed.z;
    float a = aT * 6.28318 + uTime * sp * 4.0;
    vec3 p = vec3(cos(a) * r, 0.0, sin(a) * r);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = clamp(9.0 * uProj / max(-mv.z, 1.0), 0.0, 9.0 * uDpr);
    vA = 0.6 + 0.4 * sin(uTime * 3.0 + aT * 40.0);
    float m = 3.0; // physical px: below this a point's coverage (1–4 px) jumps as it moves
    if (px < m) { vA *= pow(px / m, 1.5); px = m; }
    gl_PointSize = px;
  }
`
const beaconFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uAmt;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA * uAmt;
    gl_FragColor = vec4(uColor * a, a);
    #include <colorspace_fragment>
  }
`


setAnchor('station', [0, 90, -30])

/** From deep space the festival is a single pulsing point on an outer arm: "you are going there". */
const beaconVert2 = /* glsl */ `
  uniform float uAmt; uniform float uTime; uniform float uDpr;
  varying float vA;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    gl_PointSize = (26.0 + 8.0 * sin(uTime * 2.2)) * uDpr;
    vA = uAmt;
  }
`
const beaconFrag2 = /* glsl */ `
  uniform float uTime;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    float core = smoothstep(0.12, 0.0, r);
    float ring = (1.0 - smoothstep(0.0, 0.03, abs(r - fract(uTime * 0.5) * 0.48))) * (1.0 - fract(uTime * 0.5));
    float a = (core + ring * 0.8 + smoothstep(0.5, 0.0, r) * 0.25) * vA;
    gl_FragColor = vec4(mix(vec3(1.0, 0.55, 0.2), vec3(1.0), core) * a, a);
    #include <colorspace_fragment>
  }
`
export function Beacon() {
  const amt = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: beaconVert2, fragmentShader: beaconFrag2, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: { uAmt: amt, uTime: U.uTime, uDpr: U.uDpr } }),
    [amt],
  )
  const geo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), [])
  useFrame(({ camera }) => {
    const d = camera.position.length()
    amt.value = THREE.MathUtils.smoothstep(d, 14000, 40000) * S.galaxy
  })
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={30} />
}

export function Station() {
  const rings = useRef<THREE.Group>(null)
  const root = useRef<THREE.Group>(null)
  const lit = useMemo(() => ({ value: 0 }), [])
  const fade = useMemo(() => ({ value: 1 }), [])
  const hull = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: hullVert,
        fragmentShader: hullFrag,
        uniforms: { uBase: { value: new THREE.Color('#0E1330') }, uSeam: { value: new THREE.Color('#CFE0FF') }, uAccent: U.uAccent, uTime: U.uTime, uLit: lit, uFade: fade },
      }),
    [lit, fade],
  )
  const slab = useMemo(() => {
    // the hull hangs from the deck's edge. Its top cap is dropped: the deck surface IS the top,
    // and two coplanar-ish faces 0.5 apart z-fight badly from orbit distance
    const g = new THREE.ExtrudeGeometry(platformShape(), { depth: P.depth, bevelEnabled: false, curveSegments: 6 })
    g.rotateX(-Math.PI / 2) // shape XY → XZ (shape y = −z); the extrusion runs up…
    g.translate(0, DECK_Y - P.depth, 0) // …so drop it until its top meets the deck (winding intact)
    g.clearGroups()
    const pos = g.getAttribute('position')
    const idx: number[] = []
    for (let i = 0; i < pos.count; i += 3) {
      const top = pos.getY(i) > DECK_Y - 0.01 && pos.getY(i + 1) > DECK_Y - 0.01 && pos.getY(i + 2) > DECK_Y - 0.01
      if (!top) idx.push(i, i + 1, i + 2)
    }
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  const keel = useMemo(() => {
    // tapered underside: a box whose bottom face is pulled inward
    const w = P.maxX - P.minX
    const d = P.maxZ - P.minZ
    const g = new THREE.BoxGeometry(w * 0.86, 110, d * 0.78, 1, 1, 1)
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0) pos.setXYZ(i, pos.getX(i) * 0.38, pos.getY(i), pos.getZ(i) * 0.3)
    g.computeVertexNormals()
    g.translate((P.minX + P.maxX) / 2, -P.depth - 55, (P.minZ + P.maxZ) / 2)
    return g
  }, [])
  const edge = useMemo(() => {
    // rim lines sit in open air just outside the hull (never on a face, so never z-fighting); glow
    // lines, so they hold a stable width from orbit instead of crawling as 1 px lines
    const top = polylineSegments(platformShape(0.6).getPoints(20).map((p) => new THREE.Vector3(p.x, DECK_Y + 0.25, -p.y)), true)
    const bot = polylineSegments(platformShape(0.6).getPoints(20).map((p) => new THREE.Vector3(p.x, DECK_Y - P.depth - 0.25, -p.y)), true)
    return [
      glowLines(glowLineGeometry(top.seg, top.t), glowLineMaterial({ color: '#F1EDE4', width: 2.2, opacity: 0.9 })),
      glowLines(glowLineGeometry(bot.seg, bot.t), glowLineMaterial({ color: '#7A5CFF', width: 2.6, opacity: 0.9 })),
    ]
  }, [])
  // the orbital rings: glow lines with energy pulses running around them (never sub-pixel tori)
  const ringMat = useMemo(
    () =>
      glowLineMaterial({
        color: '#CFE0FF',
        width: 2.6,
        opacity: 0.35,
        uniforms: { uSpeed: { value: 0.03 } },
        fragment: {
          head: 'uniform float uSpeed;',
          body: `
            float ph = fract(vT * 3.0 - uTime * uSpeed);
            float pulse = exp(-ph * ph * 900.0) + exp(-(1.0 - ph) * (1.0 - ph) * 40000.0);
            a *= 0.55 + pulse * 3.5;
            col = mix(col, vec3(1.0, 0.95, 0.88), pulse * 0.6);`,
        },
      }),
    [],
  )
  const ringGeos = useMemo(
    () =>
      STATION.rings.map((r) => {
        const { seg, t } = polylineSegments(circlePoints(r.r, 256), true)
        return glowLineGeometry(seg, t)
      }),
    [],
  )
  const beacons = useMemo(() => {
    const n = 90
    const t = new Float32Array(n)
    const r = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      t[i] = Math.random()
      r[i] = i % 3
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    g.setAttribute('aRing', new THREE.BufferAttribute(r, 1))
    const R = STATION.rings
    const m = new THREE.ShaderMaterial({
      vertexShader: beaconVert,
      fragmentShader: beaconFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: U.uTime,
        uDpr: U.uDpr,
        uProj: U.uProj,
        uR: { value: new THREE.Vector3(R[0].r, R[1].r, R[2].r) },
        uSpeed: { value: new THREE.Vector3(R[0].speed, R[1].speed, R[2].speed) },
        uColor: { value: new THREE.Color('#F1EDE4') },
        uAmt: { value: 1 },
      },
    })
    return { g, m }
  }, [])
  const mastLight = useRef<THREE.Group>(null)

  useFrame(({ camera }) => {
    // at galactic scale the station hands over to its Beacon: a fade, never a pop
    const f = 1 - THREE.MathUtils.smoothstep(camera.position.length(), 30000, 40000)
    fade.value = f
    if (root.current) root.current.visible = f > 0.002
    edge.forEach((l, i) => ((l.material as THREE.ShaderMaterial).uniforms.uOpacity.value = (i === 0 ? 0.9 : 0.8) * f))
    lit.value = 0.25 + 0.75 * S.lights
    if (rings.current) rings.current.children.forEach((r, i) => (r.rotation.y = S.time * STATION.rings[i].speed))
    // rings are the station's far-field signature; they fade as the hall becomes the subject
    const far = 1 - S.markers * 0.6
    ringMat.uniforms.uOpacity.value = 0.55 * far * (1 + S.chart * 0.5) * f
    // the whole map charted: the rings take the explorer's colour (the saffron of the ship)
    ringMat.uniforms.uColor.value.set('#CFE0FF').lerp(FLARE, THREE.MathUtils.smoothstep(S.chart, 0.9, 1))
    beacons.m.uniforms.uAmt.value = far * f
    // aviation lights: a soft pulse (a hard on/off strobe reads as flicker, especially under bloom)
    if (mastLight.current)
      mastLight.current.children.forEach((c, i) => {
        const ph = Math.sin(S.time * 2.4 + i * 1.7) * 0.5 + 0.5
        c.scale.setScalar(0.25 + 0.75 * Math.pow(ph, 3))
      })
  })

  return (
    <group ref={root}>
      <mesh geometry={slab} material={hull} />
      <mesh geometry={keel} material={hull} />
      {edge.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
      <group ref={rings}>
        {STATION.rings.map((r, i) => (
          <group key={i} rotation={r.tilt as unknown as [number, number, number]}>
            <mesh geometry={ringGeos[i]} material={ringMat} frustumCulled={false} />
            <points geometry={beacons.g} material={beacons.m} frustumCulled={false} />
          </group>
        ))}
      </group>
      {/* masts with blinking tips at two corners */}
      {[
        [P.minX + 20, P.minZ + 20],
        [P.maxX - 20, P.maxZ - 20],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 40, z]} material={hull}>
          <cylinderGeometry args={[0.8, 1.6, 80, 6]} />
        </mesh>
      ))}
      <group ref={mastLight}>
        {[
          [P.minX + 20, P.minZ + 20],
          [P.maxX - 20, P.maxZ - 20],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 81, z]}>
            <sphereGeometry args={[2.4, 8, 8]} />
            <meshBasicMaterial color="#FF2A3D" />
          </mesh>
        ))}
      </group>
    </group>
  )
}
