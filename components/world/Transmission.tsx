'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { live, useWorld } from '@/lib/store'
import { transmissionById, type Artist } from '@/data/artists'
import { loadPortrait, type PortraitCloud } from '@/lib/transmission/portrait'
import { STABLE_AT, stepTransmission, tx } from '@/lib/transmission/controller'
import { BREAKPOINT } from '@/lib/constants'
import { POINT_GLSL, U, damp } from './system'
import { circlePoints, glowLineGeometry, glowLineMaterial, glowLines, polylineSegments } from './vfx/glowLines'

/**
 * THE DECRYPTION TRANSMISSION (3D). A camera-space hologram: PHOTO → DATA → SIGNAL → FACE.
 *
 * One particle system, one shader. Every particle has a target on the face (from lib/transmission/
 * portrait.ts) and travels through four formations driven by the controller's clock and the live
 * signal frame:
 *   static field → the carrier waveform (one line) → scanline strands whose amplitude carries the
 *   face's light (a ridge plot of the portrait) → the face itself, with relief.
 * Contour particles (high edge) arrive first, fills later, each with its own jitter, so eyes, nose,
 * mouth, jaw and hair emerge before the skin. Audio: bass = large-scale breathing, mid = contour
 * motion, treble = fine sparkle, amplitude = glow, transients = bursts; quiet signal = the portrait
 * settles. The face has a brightness floor and a fixed timeline: it can never vanish or stay noise.
 *
 * Around it: a dimensional waveform ribbon (three depths), spectral bars, an orbit ring with
 * travelling pulses. Budgets per tier; everything is disposed when the transmission closes.
 */
const COUNT = { low: 7000, medium: 16000, high: 26000, ultra: 38000 } as const

const vert = /* glsl */ `
  ${POINT_GLSL}
  attribute vec4 aAttr; // light, edge, row, seed
  uniform float uT; uniform float uBass; uniform float uMid; uniform float uTreble; uniform float uAmp; uniform float uTransient;
  uniform sampler2D uWave; uniform float uAspect; uniform float uReduced; uniform float uFade;
  uniform vec3 uColA; uniform vec3 uColB;
  varying vec3 vCol; varying float vA;
  float h1(float n) { return fract(sin(n) * 43758.5453); }
  float wave(float x) { return texture2D(uWave, vec2(x, 0.5)).r * 2.0 - 1.0; }
  void main() {
    float lum = aAttr.x; float edge = aAttr.y; float row = aAttr.z; float seed = aAttr.w;
    vec3 target = position;
    float u = clamp(target.x / (2.0 * uAspect) + 0.5, 0.0, 1.0);

    float sNoise = smoothstep(0.5, 1.5, uT);
    float sLine = smoothstep(2.1, 3.3, uT);
    float sRows = smoothstep(3.4, 4.7, uT);
    // contours first: edge particles land early, fills later, each with its own delay
    float arrive = 4.6 + (1.0 - edge) * 1.25 + seed * 0.55;
    float sFace = smoothstep(arrive, arrive + 0.95, uT);
    float stable = smoothstep(${STABLE_AT.toFixed(1)}, ${(STABLE_AT + 1).toFixed(1)}, uT);

    // 1 · static
    vec3 pNoise = vec3((h1(seed * 91.7) - 0.5) * 3.6 * uAspect, (h1(seed * 37.3) - 0.5) * 2.6, (h1(seed * 13.1) - 0.5) * 1.6);
    pNoise.xy += vec2(sin(uT * 3.1 + seed * 40.0), cos(uT * 2.7 + seed * 50.0)) * 0.035;
    // 2 · the carrier: every particle rides the live waveform at its own column
    vec3 pLine = vec3(target.x * 1.25, wave(u) * 0.34 * (0.45 + uAmp) + (h1(seed * 5.3) - 0.5) * 0.015, (h1(seed * 3.7) - 0.5) * 0.25);
    // 3 · strands: each face row is a waveform whose amplitude carries the face's light
    float strand = (0.07 + lum * 0.12) * (0.55 + uMid * 0.9);
    vec3 pRows = vec3(target.x, target.y + wave(fract(u * 1.7 + row * 0.37 + uT * 0.05)) * strand, target.z * 0.15);
    // 4 · the face, with relief
    vec3 pFace = target;

    vec3 p = mix(vec3(0.0, 0.25, -7.0) + pNoise * 0.03, pNoise, sNoise); // gathered at the distant marker first
    p = mix(p, pLine, sLine);
    p = mix(p, pRows, sRows);
    p = mix(p, pFace, sFace);

    // the signal lives in the face (softer once stable, much softer with reduced motion)
    float live_ = mix(1.0, 0.6, stable) * (1.0 - uReduced * 0.8) * sFace;
    vec2 radial = normalize(target.xy + vec2(1e-4, 1e-4));
    // (all motion is smooth and small: the face breathes, it never jolts or strobes)
    p.xy += radial * uBass * 0.03 * (0.6 + 0.4 * sin(target.y * 3.0 + uT * 1.7)) * live_;
    p.x += sin(row * 61.0 + uT * 3.1) * uMid * (0.3 + edge) * 0.012 * live_;
    p.xy += vec2(sin(uT * 11.0 + seed * 91.0), cos(uT * 13.0 + seed * 57.0)) * uTreble * (1.0 - edge) * 0.005 * live_;
    // transients: a spray of sparks off the surface (some particles), not the whole face jumping
    float spark = smoothstep(0.55, 1.0, seed);
    p += vec3(radial, 0.8) * uTransient * spark * (0.02 + seed * 0.07) * live_;
    // a few fragments drift toward the viewer and back: the hologram has depth
    float frag = step(0.982, seed) * stable;
    p.z += frag * (0.25 + 0.6 * (0.5 + 0.5 * sin(uT * 0.4 + seed * 60.0)));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = mix(0.022, 0.016 + lum * 0.016 + edge * 0.008, sRows);
    float px = size * uProj / max(-mv.z, 1.0);

    // light: strands and face carry the portrait's light; a floor so the face never disappears
    float bright = mix(0.35, 0.18 + 0.95 * pow(lum, 1.2) + edge * 0.35, sRows);
    bright *= 0.75 + uAmp * 0.6 + uTreble * (1.0 - edge) * 0.2 * sin(uT * 9.0 + seed * 80.0) * live_;
    bright += uTransient * (0.06 + spark * 0.5) * sFace;
    // the decode scan: a bright band sweeping down the face while it resolves
    float scanY = 1.2 - fract((uT - 3.4) / 2.6) * 2.6;
    bright += smoothstep(0.08, 0.0, abs(target.y - scanY)) * (1.0 - stable) * sRows * 1.2;
    float a = bright * mix(0.55, 1.0, sNoise) * uFade;
    gl_PointSize = stablePoint(px, a);
    vA = a;
    vec3 c = mix(uColA, uColB, clamp(row * 1.1 + (seed - 0.5) * 0.25, 0.0, 1.0));
    vCol = mix(c, vec3(1.0, 0.97, 0.92), smoothstep(0.62, 1.0, lum) * 0.75 * sRows);
  }
`
const frag = /* glsl */ `
  varying vec3 vCol; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vA;
    gl_FragColor = vec4(vCol * a, a);
    #include <colorspace_fragment>
  }
`
// spectral bars: 64 bands on a shallow arc under the portrait
const barVert = /* glsl */ `
  #define NB 64
  attribute float aBand;
  uniform float uSpec[NB]; uniform float uAmt; uniform float uAspect;
  varying float vY; varying float vB;
  void main() {
    int b = int(aBand + 0.5);
    float s = 0.0;
    for (int i = 0; i < NB; i++) if (i == b) s = uSpec[i];
    float x = (aBand / 63.0 - 0.5) * 2.3 * uAspect;
    float h = 0.03 + s * 0.55;
    vec3 p = vec3(x + position.x * 0.018 * uAspect, -1.28 + position.y * h, -0.2 - x * x * 0.25);
    vY = position.y; vB = s;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`
const barFrag = /* glsl */ `
  uniform vec3 uColA; uniform vec3 uColB; uniform float uAmt;
  varying float vY; varying float vB;
  void main() {
    float a = (0.25 + 0.75 * vY) * (0.35 + vB) * uAmt;
    gl_FragColor = vec4(mix(uColA, uColB, vY) * a, a);
    #include <colorspace_fragment>
  }
`

export function Transmission() {
  const id = useWorld((s) => s.transmission)
  const artist = transmissionById(id)
  if (!artist || !artist.image) return null
  return <TransmissionView key={artist.id} artist={artist} />
}

function TransmissionView({ artist }: { artist: Artist }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const bootTier = useWorld((s) => s.bootTier)
  const reduced = useWorld((s) => s.reducedMotion)
  const [cloud, setCloud] = useState<PortraitCloud | null>(null)
  const root = useRef<THREE.Group>(null)
  const holo = useRef<THREE.Group>(null)
  const fade = useRef(0)
  const orbit = useRef({ x: 0, y: 0 })

  // the portrait is fetched and sampled only now (never on page load)
  useEffect(() => {
    let alive = true
    tx.ready = false
    loadPortrait(artist.image!, artist.imageKind ?? 'photo', COUNT[bootTier], artist.transmissionSeed)
      .then((c) => alive && setCloud(c))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [artist, bootTier])

  // quality never changes mid-reveal
  useEffect(() => {
    live.qualityHold++
    return () => {
      live.qualityHold--
    }
  }, [])

  const waveTex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat)
    t.magFilter = t.minFilter = THREE.LinearFilter
    t.wrapS = THREE.RepeatWrapping
    t.needsUpdate = true
    return t
  }, [])
  const uni = useMemo(
    () => ({
      uT: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uAmp: { value: 0 },
      uTransient: { value: 0 },
      uWave: { value: waveTex },
      uAspect: { value: 0.8 },
      uReduced: { value: 0 },
      uFade: { value: 0 },
      uColA: { value: new THREE.Color(artist.colour[0]) },
      uColB: { value: new THREE.Color(artist.colour[1]) },
      uProj: U.uProj,
      uDpr: U.uDpr,
    }),
    [waveTex, artist],
  )

  const points = useMemo(() => {
    if (!cloud) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(cloud.pos, 3))
    g.setAttribute('aAttr', new THREE.BufferAttribute(cloud.attr, 4))
    const m = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, uniforms: uni })
    const p = new THREE.Points(g, m)
    p.frustumCulled = false
    p.renderOrder = 42
    uni.uAspect.value = cloud.aspect
    return p
  }, [cloud, uni])
  useEffect(() => {
    if (points) tx.ready = true
  }, [points])

  // the carrier as a dimensional ribbon: three glow lines at different depths, rebuilt each frame
  const ribbon = useMemo(() => {
    const N = 128
    const lines = [0, 1, 2].map((k) => {
      const seg = new Float32Array(N * 6)
      const t = Array.from({ length: N * 2 }, (_, i) => Math.floor(i / 2) / N + (i % 2) / N)
      const g = glowLineGeometry(seg, t)
      const m = glowLineMaterial({ color: k === 1 ? artist.colour[1] : artist.colour[0], width: k === 1 ? 3.2 : 2, opacity: 0, depthTest: false })
      const mesh = glowLines(g, m)
      mesh.renderOrder = 41
      return { mesh, g, m, z: [-0.35, 0, 0.35][k], amp: [0.7, 1, 0.8][k], lag: [0.08, 0, 0.05][k] }
    })
    return { N, lines }
  }, [artist])

  const bars = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    g.setAttribute('aBand', new THREE.InstancedBufferAttribute(new Float32Array(Array.from({ length: 64 }, (_, i) => i)), 1))
    g.instanceCount = 64
    const m = new THREE.ShaderMaterial({
      vertexShader: barVert,
      fragmentShader: barFrag,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uSpec: { value: new Array(64).fill(0) }, uAmt: { value: 0 }, uAspect: uni.uAspect, uColA: uni.uColA, uColB: uni.uColB },
    })
    const mesh = new THREE.Mesh(g, m)
    mesh.frustumCulled = false
    mesh.renderOrder = 41
    return mesh
  }, [uni])

  const ring = useMemo(() => {
    const { seg, t } = polylineSegments(circlePoints(1.55, 180), true)
    const m = glowLineMaterial({
      color: artist.colour[0],
      width: 2.2,
      opacity: 0,
      depthTest: false,
      fragment: { body: `float ph = fract(vT * 2.0 - uTime * 0.12); a *= 0.45 + 2.6 * exp(-ph * ph * 700.0) + 2.6 * exp(-(1.0 - ph) * (1.0 - ph) * 700.0);` },
    })
    const mesh = glowLines(glowLineGeometry(seg, t), m)
    mesh.renderOrder = 41
    mesh.rotation.set(1.25, 0, 0.18)
    return { mesh, m }
  }, [artist])

  // dispose everything this transmission created
  useEffect(
    () => () => {
      points?.geometry.dispose()
      ;(points?.material as THREE.Material | undefined)?.dispose()
    },
    [points],
  )
  useEffect(
    () => () => {
      waveTex.dispose()
      ribbon.lines.forEach((l) => (l.g.dispose(), l.m.dispose()))
      bars.geometry.dispose()
      ;(bars.material as THREE.Material).dispose()
      ring.mesh.geometry.dispose()
      ring.m.dispose()
    },
    [waveTex, ribbon, bars, ring],
  )

  const tmp = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const f = stepTransmission(dt)
    const t = tx.t
    uni.uT.value = t
    // the signal is smoothed a little for the face; transients stay sharp
    // the signal is smoothed for the face (a breathing surface, not a strobe); transients get a
    // short attack too: an instant jump would read as a flicker
    uni.uBass.value = damp(uni.uBass.value, f.bass, 9, dt)
    uni.uMid.value = damp(uni.uMid.value, f.mid, 8, dt)
    uni.uTreble.value = damp(uni.uTreble.value, f.treble, 10, dt)
    uni.uAmp.value = damp(uni.uAmp.value, f.amp, 7, dt)
    uni.uTransient.value = damp(uni.uTransient.value, f.transient, 20, dt)
    uni.uReduced.value = reduced ? 1 : 0
    const want = useWorld.getState().transmission === artist.id ? 1 : 0
    fade.current = damp(fade.current, want, 3, dt)
    uni.uFade.value = fade.current

    // waveform texture (8-bit, linearly filtered everywhere)
    const d = waveTex.image.data as Uint8Array
    for (let i = 0; i < 256; i++) d[i * 4] = Math.round((f.wave[i] * 0.5 + 0.5) * 255)
    waveTex.needsUpdate = true

    // stage envelopes shared with the shader
    const s = (a: number, b: number) => THREE.MathUtils.smoothstep(t, a, b)
    const lock = s(2.1, 3.0) * (1 - s(4.6, 5.8))
    const barsAmt = (s(1.6, 2.6) * (1 - s(5.2, 6.6) * 0.75)) * fade.current
    const ringAmt = (s(2.4, 3.6) * (0.55 + 0.45 * (1 - s(STABLE_AT, STABLE_AT + 1.5)))) * fade.current

    // the carrier ribbon follows the live waveform
    const aspect = uni.uAspect.value
    for (const L of ribbon.lines) {
      const seg = L.g.getAttribute('aA') as THREE.InstancedBufferAttribute
      const segB = L.g.getAttribute('aB') as THREE.InstancedBufferAttribute
      const amp = 0.34 * (0.45 + uni.uAmp.value) * L.amp
      const y = (i: number) => f.wave[Math.min(255, Math.floor((i / ribbon.N) * 255 + L.lag * 255) % 256)] * amp
      for (let i = 0; i < ribbon.N; i++) {
        const x0 = ((i / ribbon.N) - 0.5) * 2.5 * aspect
        const x1 = (((i + 1) / ribbon.N) - 0.5) * 2.5 * aspect
        seg.setXYZ(i, x0, y(i), L.z)
        segB.setXYZ(i, x1, y(i + 1), L.z)
      }
      seg.needsUpdate = segB.needsUpdate = true
      L.m.uniforms.uOpacity.value = lock * (L.z === 0 ? 1 : 0.5) * fade.current
    }
    const bm = bars.material as THREE.ShaderMaterial
    for (let i = 0; i < 64; i++) bm.uniforms.uSpec.value[i] = damp(bm.uniforms.uSpec.value[i], f.spec[i], 16, dt)
    bm.uniforms.uAmt.value = barsAmt
    ring.m.uniforms.uOpacity.value = ringAmt * (0.7 + f.amp * 0.8)

    // placement in camera space: centred while it decodes, then it makes room for the information
    const g = root.current
    if (g) {
      const portrait = size.width / size.height < 0.9
      const mobile = size.width < BREAKPOINT.mobile
      const settleX = portrait ? 0 : 1.35
      const stable = s(STABLE_AT - 0.4, STABLE_AT + 1.2)
      const x = settleX * stable
      const y = portrait ? 0.95 + 0.25 * stable : 0.1
      const dist = portrait ? 13.5 : 12
      tmp.set(x, y, -dist).applyMatrix4(camera.matrixWorld)
      g.position.copy(tmp)
      g.quaternion.copy(camera.quaternion)
      g.scale.setScalar(mobile ? 1.9 : portrait ? 2.2 : 2.55)
    }
    // once reconstructed, the camera moves slightly around the face (pointer), plus a slow drift
    const h = holo.current
    if (h) {
      const k = s(STABLE_AT - 1, STABLE_AT + 1) * (reduced ? 0.3 : 1)
      orbit.current.x = damp(orbit.current.x, (live.pointer.active ? live.pointer.x : 0) * 0.42 * k, 3, dt)
      orbit.current.y = damp(orbit.current.y, (live.pointer.active ? -live.pointer.y : 0) * 0.18 * k, 3, dt)
      h.rotation.set(orbit.current.y, orbit.current.x + Math.sin(t * 0.21) * 0.07 * k, 0)
    }
  })

  return (
    <group ref={root}>
      <group ref={holo}>{points && <primitive object={points} />}</group>
      {ribbon.lines.map((l, i) => (
        <primitive key={i} object={l.mesh} />
      ))}
      <primitive object={bars} />
      <primitive object={ring.mesh} />
    </group>
  )
}
