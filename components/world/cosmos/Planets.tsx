'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PLANETS, SILHOUETTES, planetEvents, type Planet, type PlanetKind } from '@/data/planets'
import { CATEGORIES } from '@/data/categories'
import { SUN_DIR, planetPosition } from '@/lib/universe'
import { QUALITY } from '@/lib/constants'
import { live, useWorld } from '@/lib/store'
import { setAnchor } from '@/lib/labels'
import { NOISE_GLSL, S, U } from '../system'
import { glowLineGeometry, glowLineMaterial, glowLines, polylineSegments } from '../vfx/glowLines'

/**
 * The five worlds of the Yashobhoomi system, plus far silhouettes for scale.
 * Hover: the atmosphere brightens, the orbit around Yashobhoomi draws itself, a label appears.
 * Click (explore): the camera flies there and the planet's events orbit it as satellites.
 */
const KIND: Record<PlanetKind, number> = { giant: 0, ocean: 1, marble: 2, ice: 3, forge: 4 }
/** 1 near the system, → 0 at galactic scale: the planets fade and shrink instead of popping out */
const FADE = { value: 1 }

const surfVert = /* glsl */ `
  varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
  void main() {
    vObj = normalize(position);
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const surfFrag = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uKind; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uAtmo;
  uniform vec3 uSun; uniform float uSeed; uniform float uTime; uniform float uHi; uniform float uSpin; uniform float uFade;
  uniform vec3 uCentre; uniform vec4 uMoons[2]; uniform vec3 uCity; uniform float uCloudSpin;
  varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndl = dot(n, uSun);
    // moon shadows: a moon between this point and the sun darkens it (soft penumbra)
    float shade = 1.0;
    for (int i = 0; i < 2; i++) {
      if (uMoons[i].w <= 0.0) continue;
      vec3 toM = uCentre + uMoons[i].xyz - vWorld;
      float along = dot(toM, uSun);
      float perp = length(toM - uSun * along);
      if (along > 0.0) shade *= mix(0.12, 1.0, smoothstep(uMoons[i].w * 0.6, uMoons[i].w * 1.25, perp));
    }
    float day = smoothstep(-0.12, 0.3, ndl) * shade;
    // rotate the surface pattern around the planet's axis
    float c = cos(uSpin), s = sin(uSpin);
    vec3 sp = vec3(c * vObj.x - s * vObj.z, vObj.y, s * vObj.x + c * vObj.z) + uSeed;
    vec3 col; vec3 emit = vec3(0.0);
    if (uKind < 0.5) {                      // gas giant: bands + storms
      float turb = fbm3(sp * 3.0, 4);
      float bands = sin(vObj.y * 20.0 + turb * 5.0) * 0.5 + 0.5;
      col = mix(uA, uB, bands);
      col = mix(col, uC, smoothstep(0.62, 0.85, fbm3(sp * 7.0, 3)) * 0.55);
    } else if (uKind < 1.5) {               // ocean world with clouds
      float land = fbm3(sp * 3.2, 5);
      col = mix(uA, uB, smoothstep(0.42, 0.62, land));
      float cl = smoothstep(0.55, 0.78, fbm3(sp * 5.0 + vec3(uTime * 0.01, 0.0, 0.0), 4));
      col = mix(col, uC, cl * 0.75);
    } else if (uKind < 2.5) {               // marbled pastel
      float w = fbm3(sp * 2.0 + fbm3(sp * 4.0, 3) * 2.0, 4);
      col = mix(uA, uB, w);
      col = mix(col, uC, smoothstep(0.02, 0.0, abs(sin(w * 18.0))) * 0.6);
    } else if (uKind < 3.5) {               // fractured ice
      float f = fbm3(sp * 3.5, 4);
      float crack = 1.0 - smoothstep(0.0, 0.035, abs(fbm3(sp * 7.0, 4) - 0.5));
      col = mix(uB, uC, f);
      col = mix(col, uA, crack * 0.8);
      emit = vec3(0.3, 0.55, 1.0) * crack * (1.0 - day) * 0.35;
    } else {                                 // forge: rock with glowing fissures
      float rock = fbm3(sp * 5.0, 4);
      col = mix(uA, uB, rock);
      float lava = 1.0 - smoothstep(0.0, 0.05, abs(fbm3(sp * 4.0, 5) - 0.5));
      emit = uC * lava * (0.35 + 0.9 * (1.0 - day));
    }
    // a cloud layer with its own, slower drift (not glued to the surface)
    if (uKind > 0.5 && uKind < 3.5) {
      float c2 = cos(uCloudSpin), s2 = sin(uCloudSpin);
      vec3 cp = vec3(c2 * vObj.x - s2 * vObj.z, vObj.y, s2 * vObj.x + c2 * vObj.z) * 4.2 + uSeed * 3.0;
      float cl = smoothstep(0.58, 0.82, fbm3(cp, 4)) * 0.55;
      col = mix(col, vec3(0.92, 0.95, 1.0), cl * day);
    }
    // night side: small clusters of light in the world's colour (festival cities); they fade out
    // before they could shrink below a pixel, so they never shimmer from far away
    float night = 1.0 - smoothstep(-0.25, 0.05, ndl);
    vec3 lp = sp * 55.0;
    float fw = length(fwidth(lp));
    float lights = pow(clamp(vnoise(lp) * 1.7 - 0.95, 0.0, 1.0), 2.0) * smoothstep(0.52, 0.72, fbm3(sp * 5.0, 3));
    emit += uCity * lights * night * (1.0 - smoothstep(0.35, 0.9, fw)) * (uKind > 0.5 ? 1.6 : 0.0);
    vec3 lit = col * (0.03 + 1.1 * day * max(ndl, 0.0) + 0.05 * day);
    float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    vec3 rim = uAtmo * fres * (0.25 + 0.85 * day) * (0.8 + uHi * 1.1);
    // the terminator glows warm: scattered light where day turns to night
    float term = exp(-pow(ndl * 5.0, 2.0)) * fres;
    rim += mix(uAtmo, vec3(1.0, 0.62, 0.36), 0.55) * term * 0.6;
    gl_FragColor = vec4((lit + rim + emit) * uFade, 1.0);
    #include <colorspace_fragment>
  }
`
const atmoFrag = /* glsl */ `
  uniform vec3 uAtmo; uniform vec3 uSun; uniform float uHi; uniform float uFade;
  varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float lim = pow(clamp(1.0 - abs(dot(n, V)), 0.0, 1.0), 4.0);
    float day = smoothstep(-0.35, 0.4, dot(n, uSun));
    float a = lim * (0.3 + 0.9 * day) * (0.75 + uHi * 1.05) * uFade;
    vec3 c = mix(uAtmo, vec3(1.0, 0.7, 0.45), exp(-pow(dot(n, uSun) * 4.0, 2.0)) * 0.45); // sunset band
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`
const ringVert = /* glsl */ `
  varying vec3 vWorld; varying vec2 vUv;
  void main() {
    vUv = position.xy;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const ringFrag = /* glsl */ `
  ${NOISE_GLSL}
  uniform vec3 uColor; uniform vec3 uSun; uniform vec3 uCentre; uniform float uR; uniform float uIn; uniform float uOut; uniform float uHi; uniform float uFade;
  varying vec3 vWorld; varying vec2 vUv;
  void main() {
    float r = length(vUv);
    float t = (r - uIn) / (uOut - uIn);
    float bands = 0.35 + 0.65 * vnoise(vec3(t * 60.0, 0.0, 0.0)) * vnoise(vec3(t * 13.0, 2.0, 0.0));
    float edge = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.92, 1.0, t));
    float gap = 1.0 - smoothstep(0.012, 0.0, abs(t - 0.62)) * 0.85;
    // the planet's shadow falls across the ring
    vec3 toC = uCentre - vWorld;
    float along = dot(toC, uSun);
    float perp = length(toC - uSun * along);
    float shadow = (along > 0.0 && perp < uR) ? 0.18 : 1.0;
    float a = bands * edge * gap * 0.75 * (0.8 + uHi * 0.4) * uFade;
    vec3 col = uColor * shadow * (0.5 + 0.5 * bands);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`
/** the orbit around Yashobhoomi: antialiased dashes + a travelling comet head (glow line) */
const ORBIT_FRAG = `
  float dash = stripe(vT * 180.0, 0.5);
  float head = smoothstep(0.08, 0.0, fract(vT - uTime * 0.02));
  a *= uAmt * (0.3 * dash + head * 1.1);
  col = mix(col, vec3(1.0), head * 0.3);`

function surfaceMaterial(p: Planet) {
  const c = p.colors.map((x) => new THREE.Color(x))
  return new THREE.ShaderMaterial({
    vertexShader: surfVert,
    fragmentShader: surfFrag,
    uniforms: {
      uKind: { value: KIND[p.kind] },
      uA: { value: c[0] },
      uB: { value: c[1] },
      uC: { value: c[2] },
      uAtmo: { value: new THREE.Color(p.atmosphere) },
      uSun: { value: SUN_DIR },
      uSeed: { value: p.radius * 0.0013 },
      uTime: U.uTime,
      uHi: { value: 0 },
      uSpin: { value: 0 },
      uFade: FADE,
      uCentre: { value: planetPosition(p) },
      uMoons: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uCity: { value: new THREE.Color(p.accent).lerp(new THREE.Color('#FFF4E0'), 0.35) },
      uCloudSpin: { value: 0 },
    },
  })
}

function PlanetBody({ p, index, detail }: { p: Planet; index: number; detail: number }) {
  const centre = useMemo(() => planetPosition(p), [p])
  const surf = useMemo(() => surfaceMaterial(p), [p])
  const atmo = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: surfVert,
        fragmentShader: atmoFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        uniforms: { uAtmo: surf.uniforms.uAtmo, uSun: surf.uniforms.uSun, uHi: surf.uniforms.uHi, uFade: FADE },
      }),
    [surf],
  )
  const ring = useMemo(() => {
    if (!p.ring) return null
    const m = new THREE.ShaderMaterial({
      vertexShader: ringVert,
      fragmentShader: ringFrag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uColor: { value: new THREE.Color(p.ring.color) },
        uSun: { value: SUN_DIR },
        uCentre: { value: centre },
        uR: { value: p.radius },
        uIn: { value: p.ring.inner * p.radius },
        uOut: { value: p.ring.outer * p.radius },
        uHi: surf.uniforms.uHi,
        uFade: FADE,
      },
    })
    return m
  }, [p, centre, surf])
  const orbit = useMemo(() => {
    // the planet's orbit around Yashobhoomi: a circle through it, centred on the station
    const r = centre.length()
    const e1 = centre.clone().normalize()
    const e2 = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), e1).normalize()
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * Math.PI * 2
      pts.push(e1.clone().multiplyScalar(Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r))
    }
    const { seg, t } = polylineSegments(pts, true)
    const m = glowLineMaterial({ color: p.accent, width: 2.4, uniforms: { uAmt: { value: 0 } }, fragment: { head: 'uniform float uAmt;', body: ORBIT_FRAG } })
    return glowLines(glowLineGeometry(seg, t), m)
  }, [centre, p.accent])
  const moonMat = useMemo(() => {
    const m = surfaceMaterial({ ...p, kind: 'marble', colors: ['#1C1C24', '#5A5A66', '#B8B8C4'], atmosphere: '#000000', radius: p.radius * 0.37 })
    m.uniforms.uCity.value.set('#000000') // moons are uninhabited
    return m
  }, [p])
  const moons = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)

  useFrame(() => {
    const hi = S.planetHi[index]
    surf.uniforms.uHi.value = hi
    surf.uniforms.uSpin.value = S.time * 0.004 * (index % 2 ? -1 : 1)
    surf.uniforms.uCloudSpin.value = S.time * 0.0095 * (index % 2 ? -1 : 1)
    ;(orbit.material as THREE.ShaderMaterial).uniforms.uAmt.value = Math.max(hi, S.planetLabels * 0.28) * FADE.value
    if (body.current) body.current.scale.setScalar(0.35 + 0.65 * FADE.value)
    if (moons.current)
      moons.current.children.forEach((m, i) => {
        const mo = p.moons[i]
        const a = mo.phase + S.time * mo.speed
        m.position.set(Math.cos(a) * mo.dist, Math.sin(a) * mo.dist * mo.incline, Math.sin(a) * mo.dist)
        // the planet knows where its moons are: they cast shadows on it
        ;(surf.uniforms.uMoons.value as THREE.Vector4[])[i]?.set(m.position.x, m.position.y, m.position.z, mo.radius)
      })
  })

  return (
    <>
      <primitive object={orbit} />
      <group position={centre} ref={body}>
        <mesh material={surf}>
          <icosahedronGeometry args={[p.radius, detail]} />
        </mesh>
        <mesh material={atmo} scale={1.07}>
          <icosahedronGeometry args={[p.radius, Math.max(2, detail - 2)]} />
        </mesh>
        {ring && p.ring && (
          <mesh material={ring} rotation={[Math.PI / 2 + p.ring.tilt, 0, p.ring.tilt * 0.5]}>
            <ringGeometry args={[p.ring.inner * p.radius, p.ring.outer * p.radius, 160, 1]} />
          </mesh>
        )}
        <group ref={moons}>
          {p.moons.map((m) => (
            <mesh key={m.name} material={moonMat}>
              <icosahedronGeometry args={[m.radius, Math.max(1, detail - 3)]} />
            </mesh>
          ))}
        </group>
      </group>
    </>
  )
}

function Silhouettes() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: surfVert,
        fragmentShader: /* glsl */ `
          uniform vec3 uSun;
          varying vec3 vN; varying vec3 vObj; varying vec3 vWorld;
          void main() {
            vec3 n = normalize(vN); vec3 V = normalize(cameraPosition - vWorld);
            float rim = pow(1.0 - max(dot(n, V), 0.0), 5.0) * smoothstep(-0.2, 0.6, dot(n, uSun));
            gl_FragColor = vec4(vec3(0.006, 0.008, 0.016) + vec3(0.45, 0.55, 0.9) * rim * 0.5, 1.0);
            #include <colorspace_fragment>
          }`,
        uniforms: { uSun: { value: SUN_DIR } },
      }),
    [],
  )
  return (
    <>
      {SILHOUETTES.map((s, i) => (
        <mesh key={i} position={s.pos} material={mat}>
          <icosahedronGeometry args={[s.radius, 4]} />
        </mesh>
      ))}
    </>
  )
}

/**
 * A world's events orbit it as satellites once you arrive: small lit nodes on a tilted ring,
 * each labelled (anchors `sat:<slug>`, rendered by WorldLabels).
 */
const satVert = /* glsl */ `
  attribute vec3 aColor; attribute float aPhase;
  uniform float uTime; uniform float uR; uniform float uAmt; uniform float uDpr;
  varying vec3 vC; varying float vA;
  void main() {
    float a = aPhase + uTime * 0.05;
    vec3 p = vec3(cos(a) * uR, sin(a * 2.0) * uR * 0.08, sin(a) * uR);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 9.0 * uDpr;
    vC = aColor; vA = uAmt;
  }
`
const satFrag = /* glsl */ `
  varying vec3 vC; varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = abs(c.x) + abs(c.y);
    float a = (1.0 - smoothstep(0.2, 0.26, d) + (1.0 - smoothstep(0.0, 0.04, abs(d - 0.42))) * 0.7) * vA;
    gl_FragColor = vec4(mix(vC, vec3(1.0), 0.3) * a, a);
    #include <colorspace_fragment>
  }
`
export const satelliteAnchor = (p: Planet, i: number, n: number, t: number) => {
  const a = (i / n) * Math.PI * 2 + t * 0.05
  const r = p.radius * 1.9
  return [Math.cos(a) * r, Math.sin(a * 2) * r * 0.08 + p.radius * 0.05, Math.sin(a) * r] as const
}

function Satellites() {
  const amt = useMemo(() => ({ value: 0 }), [])
  const R = useMemo(() => ({ value: 1 }), [])
  const group = useRef<THREE.Group>(null)
  const current = useRef<string | null>(null)
  const geo = useMemo(() => new THREE.BufferGeometry(), [])
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: satVert, fragmentShader: satFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uR: R, uAmt: amt, uDpr: U.uDpr } }),
    [amt, R],
  )
  useFrame((_, dt) => {
    const st = useWorld.getState()
    const id = st.mode === 'explore' && st.nav.kind === 'planet' ? st.nav.id : null
    amt.value += ((id ? 1 : 0) - amt.value) * Math.min(1, dt * 4)
    if (id && id !== current.current) {
      current.current = id
      const p = PLANETS.find((x) => x.id === id)!
      const evs = planetEvents(p)
      const col = new Float32Array(evs.length * 3)
      const ph = new Float32Array(evs.length)
      const c = new THREE.Color()
      evs.forEach((e, i) => {
        c.set(CATEGORIES.find((x) => x.id === e.category)?.accent ?? '#CFE0FF')
        col.set([c.r, c.g, c.b], i * 3)
        ph[i] = (i / evs.length) * Math.PI * 2
      })
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(evs.length * 3), 3))
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
      geo.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
      R.value = p.radius * 1.9
      group.current?.position.copy(planetPosition(p))
    }
    // keep the DOM labels riding their satellites
    if (current.current && amt.value > 0.02) {
      const p = PLANETS.find((x) => x.id === current.current)!
      const evs = planetEvents(p)
      const c = planetPosition(p)
      evs.forEach((e, i) => {
        const [x, y, z] = satelliteAnchor(p, i, evs.length, S.time)
        setAnchor(`sat:${e.slug}`, [c.x + x, c.y + y + p.radius * 0.12, c.z + z])
      })
    }
    if (group.current) group.current.visible = amt.value > 0.01
  })
  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} />
    </group>
  )
}

/* label anchors: above each planet */
PLANETS.forEach((p) => setAnchor(`planet:${p.id}`, planetPosition(p).add(new THREE.Vector3(0, p.radius * 1.35, 0))))

export function Planets() {
  const tier = useWorld((s) => s.bootTier)
  const detail = QUALITY[tier].planetDetail
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const last = useRef<string | null>(null)
  const v = useMemo(() => new THREE.Vector3(), [])
  const centres = useMemo(() => PLANETS.map((p) => planetPosition(p)), [])

  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    // at galactic scale the system is one point of light (see Beacon); planets would read as toys.
    // They fade and shrink over a range instead of popping at a threshold.
    FADE.value = 1 - THREE.MathUtils.smoothstep(camera.position.length(), 30000, 40000)
    if (group.current) group.current.visible = FADE.value > 0.002
    const st = useWorld.getState()
    const canHover = !st.coarse && live.pointer.active && live.pointer.overWorld && !live.orbit.dragging && (st.mode === 'explore' || (st.mode === 'home' && S.planetLabels > 0.5))
    let best: string | null = null
    let bestD = Infinity
    if (canHover) {
      const dpr = U.uDpr.value
      PLANETS.forEach((p, i) => {
        v.copy(centres[i]).project(camera)
        if (v.z > 1) return
        const dist = camera.position.distanceTo(centres[i])
        const rpx = (p.radius * U.uProj.value) / dist / dpr
        const x = ((v.x + 1) / 2) * size.width
        const y = ((1 - v.y) / 2) * size.height
        // hysteresis: the hovered world keeps a larger catch radius, so edges never flicker between states
        const d = Math.hypot(x - live.pointer.px, y - live.pointer.py) * (p.id === last.current ? 0.75 : 1)
        if (d < Math.max(rpx * 1.1, 22) && dist < bestD) {
          bestD = dist
          best = p.id
        }
      })
    }
    if (best !== last.current) {
      last.current = best
      st.set({ hoveredPlanet: best })
    }
    if (best) {
      live.hoverKind = 'planet'
      live.hoverLabel = PLANETS.find((p) => p.id === best)!.name
    }
  })

  return (
    <group ref={group}>
      {PLANETS.map((p, i) => (
        <PlanetBody key={p.id} p={p} index={i} detail={detail} />
      ))}
      <Silhouettes />
      <Satellites />
    </group>
  )
}
