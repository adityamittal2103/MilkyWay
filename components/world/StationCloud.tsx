'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useVenueData } from '@/lib/venueData'
import { makeAccretion } from '@/lib/galaxy'
import { useWorld } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { S, U, budget, ZONE_GLSL } from './system'

/**
 * The Yashobhoomi reveal (WOW 03). Every particle has two homes: a mote in the station's
 * accretion swirl, and a point sampled from the surface of the real venue geometry (walls,
 * props, the bulb curtain…). `uMorph` flies each one from the first to the second along a
 * swirling arc, staggered so the cloud implodes onto the hall and the architecture appears.
 */
const vert = /* glsl */ `
  ${ZONE_GLSL}
  attribute vec3 aGal;
  attribute vec3 aGalCol;
  attribute vec4 aSeed; // rand, kind, galaxy size, phase
  uniform float uTime;
  uniform float uMorph;
  uniform float uReveal;
  uniform float uLights;
  uniform float uCloud;
  uniform float uFilterAmt;
  uniform vec3 uAccent;
  uniform float uWarp;
  uniform float uDpr;
  uniform float uSpin;
  uniform vec3 uPointer;
  uniform float uPointerAmt;
  uniform vec3 uStarlight; uniform vec3 uIon; uniform vec3 uPulsar; uniform vec3 uFlare; uniform vec3 uDust; uniform vec3 uLumen;
  varying vec3 vCol;
  varying float vA;

  vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * p; }

  void main() {
    float rnd = aSeed.x;
    float kind = aSeed.y;

    // galaxy: differential rotation (inner stars orbit faster)
    vec3 g = aGal;
    float rg = length(g.xz);
    g.xz = rot(g.xz, uSpin * (1.0 + 900.0 / (rg + 400.0)));

    // staggered morph: outer arms leave first, core last → implosion
    float order = clamp(1.0 - rg / 2700.0, 0.0, 1.0) * 0.55 + rnd * 0.45;
    float t = clamp((uMorph * 1.55 - order * 0.55), 0.0, 1.0);
    t = t * t * (3.0 - 2.0 * t);
    float arc = sin(t * 3.14159);

    vec3 v = position;
    vec3 p = mix(g, v, t);
    p.xz = rot(p.xz, arc * (1.4 + rnd * 1.2));        // swirl while in flight
    p.y += arc * (80.0 + 220.0 * rnd);                  // and lift over an arc

    // pointer gravity: lensing ring in the galaxy, a soft swell over the venue
    vec3 d = p - uPointer;
    float r = length(d.xz);
    float galAmt = (1.0 - t);
    p.xz += normalize(d.xz + 1e-4) * uPointerAmt * galAmt * 120.0 * exp(-r * r / 60000.0);
    p.y += uPointerAmt * t * 5.0 * exp(-r * r / 700.0);

    // warp: particles stretch outward from the view axis
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    mv.xy *= 1.0 + uWarp * 0.12;

    // sector focus (venue state)
    float focus = 0.0; vec3 fcol = vec3(0.0);
    for (int i = 0; i < ZONES; i++) {
      float m = rectMask(v.xz, uZones[i], 2.0) * uZoneFocus[i];
      focus += m; fcol += uZoneColor[i] * m;
    }
    focus = clamp(focus, 0.0, 1.0);

    // venue colours by source category: wall, furniture, prop, emissive, outline, bulb
    vec3 vc = uStarlight;
    float vs = 1.0;
    if (kind < 0.5) { vc = uStarlight; vs = 0.9; }
    else if (kind < 1.5) { vc = uLumen; vs = 0.9; }
    else if (kind < 2.5) { vc = mix(uIon, uLumen, 0.35); vs = 0.85; }
    else if (kind < 3.5) { vc = uPulsar; vs = 1.4; }
    else if (kind < 4.5) { vc = uDust; vs = 0.8; }
    else { vc = mix(uFlare, vec3(1.0, 0.85, 0.6), 0.5); vs = 1.1 + uLights * 0.8; }
    vc = mix(vc, fcol * 1.4 + 0.15, focus * 0.85);

    vCol = mix(aGalCol, vc, t);
    float twinkle = 0.8 + 0.2 * sin(uTime * (2.0 + rnd * 4.0) + aSeed.w * 30.0);
    float size = mix(aSeed.z * 5.0, vs * (1.0 + focus * 0.9), t) * twinkle;

    // once the architecture is solid, particles recede into surface sparkle
    float solid = uReveal * t;
    vA = mix(uCloud * 0.6, 0.9, t) * (1.0 - solid * 0.55) * (kind > 4.5 ? mix(1.0, 0.35 + 0.65 * uLights, t) : 1.0);
    // filter heat: matching sectors' particles take the accent and brighten
    float heat = 0.0;
    for (int i = 0; i < ZONES; i++) heat += rectMask(v.xz, uZones[i], 2.0) * uZoneHeat[i];
    vCol = mix(vCol, uAccent * 1.3, clamp(heat, 0.0, 1.0) * uFilterAmt * t * 0.7);
    vA *= mix(1.0, 0.35 + heat * 1.2, uFilterAmt * t);
    vA *= 1.0 + focus * 0.8;

    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(size * uDpr * 520.0 / max(-mv.z, 1.0), 0.0, 22.0 * uDpr);
    // tiny points shimmer instead of popping: keep a floor on size but fade alpha
    float m = 3.0; // physical px: below this a point's coverage (1–4 px) jumps as it moves
    if (gl_PointSize < m) { vA *= pow(gl_PointSize / m, 1.5); gl_PointSize = m; }
  }
`
const frag = /* glsl */ `
  varying vec3 vCol;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a * vA;
    gl_FragColor = vec4(vCol * a, a);
    #include <colorspace_fragment>
  }
`

export function StationCloud() {
  const data = useVenueData()
  const tier = useWorld((s) => s.bootTier)
  const dpr = useThree((s) => s.viewport.dpr)
  const count = Math.min(QUALITY[tier].particles, data.meta.points.count)

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const gal = makeAccretion(count)
    g.setAttribute('position', new THREE.BufferAttribute(data.points.subarray(0, count * 3), 3))
    g.setAttribute('aGal', new THREE.BufferAttribute(gal.pos, 3))
    g.setAttribute('aGalCol', new THREE.BufferAttribute(gal.col, 3))
    const seed = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      seed[i * 4] = Math.random()
      seed[i * 4 + 1] = data.kinds[i]
      seed[i * 4 + 2] = gal.size[i]
      seed[i * 4 + 3] = Math.random()
    }
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2200)
    return g
  }, [count, data])

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          ...U,
          uDpr: { value: 1 },
          uSpin: { value: 0 },
        },
      }),
    [],
  )

  useFrame((_, dt) => {
    mat.uniforms.uDpr.value = dpr
    // the galaxy keeps turning until it has become the hall
    mat.uniforms.uSpin.value += Math.min(dt, 0.05) * 0.06 * (1 - S.morph)
    geo.setDrawRange(0, Math.min(count, budget('particles')))
  })

  return <points geometry={geo} material={mat} frustumCulled={false} />
}
