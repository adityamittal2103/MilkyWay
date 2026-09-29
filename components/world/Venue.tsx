'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useVenueData } from '@/lib/venueData'
import { HALL } from '@/lib/constants'
import { DECK_Y, platformShape } from '@/lib/universe'
import { AA_GLSL, S, U, ZONE_GLSL } from './system'
import { glowLineGeometry, glowLineMaterial, glowLines } from './vfx/glowLines'

/**
 * The hall, restyled as a luminous architectural model:
 * dark matte bodies, rim light, a warm top-edge on every wall (blueprint linework), and a
 * light-front that sweeps along the hall to "draw" it in (uReveal). Sectors tint on focus.
 */

const REVEAL_GLSL = /* glsl */ `
  uniform float uReveal;
  float revealFront() { return mix(${(HALL.min[0] - 40).toFixed(1)}, ${(HALL.max[0] + 40).toFixed(1)}, uReveal); }
`

const archVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const archFrag = /* glsl */ `
  ${ZONE_GLSL}
  ${REVEAL_GLSL}
  ${AA_GLSL}
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform vec3 uEdge;
  uniform float uTopY;
  uniform float uTopAmt;
  uniform float uTime;
  uniform float uDim;
  uniform float uLights;
  uniform vec3 uAccent;
  uniform float uFilterAmt;
  uniform float uSurge;
  varying vec3 vWorld;
  void main() {
    float front = revealFront();
    // dissolve the edge of the front with a little noise so it reads as light, not a clip plane
    float n = fract(sin(dot(floor(vWorld.xz * 0.6), vec2(12.9898, 78.233))) * 43758.5453);
    if (vWorld.x > front + n * 6.0 - 3.0) discard;

    // flat normal from screen derivatives; degenerate pixels (silhouettes) would normalise a zero
    // vector into NaN, and one NaN pixel smears across the whole frame under bloom
    vec3 cr = cross(dFdx(vWorld), dFdy(vWorld));
    float cl = length(cr);
    vec3 nrm = cl > 1e-10 ? cr / cl : vec3(0.0, 1.0, 0.0);
    vec3 V = normalize(cameraPosition - vWorld);
    if (dot(nrm, V) < 0.0) nrm = -nrm;
    vec3 L = normalize(vec3(-0.35, 0.85, 0.4));
    float ndl = max(dot(nrm, L), 0.0);
    float rim = pow(1.0 - abs(dot(nrm, V)), 2.4);

    vec3 col = uBase * (0.45 + 0.75 * ndl) + uRim * rim * 0.5;
    col *= mix(0.45, 1.0, smoothstep(0.0, 4.0, vWorld.y));                  // contact shadow
    col += uEdge * smoothstep(uTopY - 0.7, uTopY, vWorld.y) * uTopAmt;       // lit wall caps

    // sector focus: tint + upward scanlines
    for (int i = 0; i < ZONES; i++) {
      float m = rectMask(vWorld.xz, uZones[i], 1.5);
      float f = uZoneFocus[i] * m;
      float scan = stripe(vWorld.y * 0.35 - uTime * 0.8, 0.14);
      col = mix(col, uZoneColor[i] * (0.45 + rim * 0.8), f * 0.32);
      col += uZoneColor[i] * f * scan * 0.35;
      col += uZoneColor[i] * m * uZoneLight[i] * uLights * 0.05;
      // filter heat: matching sectors light their architecture from within
      col += uAccent * m * uZoneHeat[i] * uFilterAmt * (0.06 + rim * 0.28);
    }
    // non-matching sectors dim under a filter, but stay readable for orientation
    float anyHeat = 0.0;
    for (int i = 0; i < ZONES; i++) anyHeat = max(anyHeat, rectMask(vWorld.xz, uZones[i], 1.5) * uZoneHeat[i]);
    col *= 1.0 - uFilterAmt * 0.45 * (1.0 - anyHeat);

    // light front
    col += uEdge * smoothstep(front - 10.0, front, vWorld.x) * 1.6;
    // landing / filter surge: the architecture catches the light
    col += (uAccent * 0.6 + uEdge * 0.4) * rim * uSurge * 0.5;
    col *= 1.0 - uDim * 0.5;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const floorVert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const floorFrag = /* glsl */ `
  ${ZONE_GLSL}
  ${REVEAL_GLSL}
  uniform vec3 uAbyss; uniform vec3 uStarlight; uniform vec3 uIon; uniform vec3 uDust;
  uniform vec2 uHallMin; uniform vec2 uHallMax;
  uniform vec3 uPointer; uniform float uPointerAmt;
  uniform float uTime; uniform float uDim; uniform float uLights;
  uniform vec4 uMarks[3];
  uniform vec3 uAccent; uniform float uFilterAmt;
  uniform vec4 uPulse; uniform vec3 uPulseColor;
  uniform vec4 uFilterWave; uniform float uSurge;
  varying vec3 vWorld;
  ${AA_GLSL}

  // antialiased grid that fades out before its lines get finer than a pixel (no moiré crawl)
  float grid(vec2 p, float s, float w) {
    vec2 q = p / s;
    vec2 fw = max(fwidth(q), vec2(1e-5));
    vec2 g = abs(fract(q - 0.5) - 0.5) / fw;
    float l = 1.0 - min(min(g.x, g.y) / w, 1.0);
    return l * (1.0 - smoothstep(0.08, 0.3, max(fw.x, fw.y)));
  }
  void main() {
    vec2 p = vWorld.xz;
    float front = revealFront();
    float shown = 1.0 - smoothstep(front - 2.0, front + 6.0, p.x);

    vec4 hall = vec4(uHallMin, uHallMax);
    float inHall = rectMask(p, hall, 0.8);
    float fall = 1.0;

    // the deck: dark outside the hall, abyss inside, grid everywhere
    vec3 col = mix(vec3(0.012, 0.016, 0.034), uAbyss, inHall) * mix(0.55, 1.0, shown);
    col += uStarlight * (grid(p, 10.0, 1.0) * 0.045 + grid(p, 50.0, 1.4) * 0.08) * mix(0.35, 1.0, inHall) * shown;
    col += uStarlight * rectEdge(p, hall, 0.9) * 0.55 * shown;               // hall outline

    // painted floor marks from the model (stage apron etc.)
    for (int i = 0; i < 3; i++) col += uStarlight * rectMask(p, uMarks[i], 0.5) * 0.035 * shown;

    // sectors: dashed outlines always, fills on light/focus
    for (int i = 0; i < ZONES; i++) {
      vec4 r = uZones[i];
      float inside = rectMask(p, r, 0.6);
      float edge = rectEdge(p, r, 0.7);
      float dash = stripe((p.x + p.y) * 0.08, 0.55);
      float light = uZoneLight[i] * uLights;
      float f = uZoneFocus[i];
      col += uZoneColor[i] * (inside * (0.035 * light + 0.16 * f) + edge * dash * (0.18 * light + 0.5 * f)) * shown;
      col += uZoneColor[i] * inside * f * stripe(p.y * 0.2 + uTime * 0.6, 0.1) * 0.12;
    }

    // filter heatmap: soft light pooling in matching sectors
    for (int i = 0; i < ZONES; i++) {
      vec4 r = uZones[i];
      vec2 c = (r.xy + r.zw) * 0.5; vec2 h = (r.zw - r.xy) * 0.5;
      vec2 q = (p - c) / max(h, vec2(8.0));
      float blob = exp(-dot(q, q) * 1.4);
      col += uAccent * blob * uZoneHeat[i] * uFilterAmt * 0.16 * shown;
    }
    col *= 1.0 - uFilterAmt * 0.25;

    // click / landing shockwave
    float age = uTime - uPulse.w;
    if (age > 0.0 && age < 1.6) {
      float pr = distance(p, uPulse.xz);
      float ring = 1.0 - smoothstep(0.0, 3.0 + age * 6.0, abs(pr - age * 90.0));
      col += uPulseColor * ring * (1.0 - age / 1.6) * 0.9;
    }

    // filter colour field: a ring of the new light sweeps the hall, the field changes behind it
    float fa = uTime - uFilterWave.z;
    if (fa > 0.0 && fa < 1.8) {
      float fr = distance(p, uFilterWave.xy);
      float front = fa * uFilterWave.w;
      float band = 1.0 - smoothstep(0.0, 12.0 + fa * 10.0, abs(fr - front));
      col += uAccent * band * (1.0 - fa / 1.8) * 0.85 * inHall * shown;
      col += uAccent * (1.0 - smoothstep(front - 50.0, front, fr)) * exp(-fa * 2.4) * 0.14 * inHall * shown;
    }
    col *= 1.0 + uSurge * 0.45;

    // pointer spotlight
    float pd = distance(p, uPointer.xz);
    col += uIon * uPointerAmt * (exp(-pd * pd / 300.0) * 0.16 + (1.0 - smoothstep(0.0, 1.2, abs(pd - 14.0))) * 0.25) * inHall * shown;

    // light front on the floor
    col += uStarlight * (smoothstep(front - 14.0, front, p.x) * (1.0 - smoothstep(front, front + 2.0, p.x))) * 0.9 * inHall;

    col *= 1.0 - uDim * 0.6;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

// wall caps (glow lines): drawn in by the same light front as the architecture
const CAP_HOOKS = {
  vertex: { head: 'varying float vWX;', body: 'vWX = mix(aA.x, aB.x, position.x);' },
  fragment: {
    head: `${REVEAL_GLSL}
      uniform float uDim; varying float vWX;`,
    body: `if (vWX > revealFront()) discard;
      a *= 1.0 - uDim * 0.5;`,
  },
}

const bulbVert = /* glsl */ `
  ${ZONE_GLSL}
  attribute float aPhase;
  uniform float uTime; uniform float uLights; uniform float uDpr; uniform float uSurge;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float on = smoothstep(aPhase * 0.85, aPhase * 0.85 + 0.15, uLights);
    float tw = 0.65 + 0.35 * sin(uTime * (1.5 + aPhase * 3.0) + aPhase * 90.0);
    float focus = 0.0;
    for (int i = 0; i < ZONES; i++) focus += rectMask(position.xz, uZones[i], 4.0) * uZoneFocus[i];
    // hovering the sector: the curtain runs a chase pattern
    float ph = fract(position.x * 0.05 - uTime * 1.6);
    float chase = smoothstep(0.55, 0.8, ph) * (1.0 - smoothstep(0.85, 1.0, ph)) * focus;
    vA = on * tw * (1.0 + focus * 0.8 + chase * 1.5) * (1.0 + uSurge * 1.3);
    float px = clamp(1.7 * uDpr * 380.0 / max(-mv.z, 1.0), 0.0, 14.0 * uDpr);
    float m = 3.0; // physical px: below this a point's coverage (1–4 px) jumps as it moves
    if (px < m) { vA *= pow(px / m, 1.5); px = m; }
    gl_PointSize = px;
  }
`
const bulbFrag = /* glsl */ `
  uniform vec3 uFlare;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d); a *= a * vA;
    vec3 c = mix(uFlare, vec3(1.0, 0.92, 0.75), 0.55);
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`

function useArchMaterial(base: string, rim: string, edge: string, topAmt: number) {
  return useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: archVert,
        fragmentShader: archFrag,
        uniforms: {
          ...U,
          uBase: { value: new THREE.Color(base) },
          uRim: { value: new THREE.Color(rim) },
          uEdge: { value: new THREE.Color(edge) },
          uTopY: { value: HALL.wallHeight },
          uTopAmt: { value: topAmt },
        },
      }),
    [base, rim, edge, topAmt],
  )
}

export function Venue() {
  const data = useVenueData()
  const dpr = useThree((s) => s.viewport.dpr)
  const group = useRef<THREE.Group>(null)

  const wallMat = useArchMaterial('#1A2140', '#5B8CFF', '#F1EDE4', 1.2)
  const furnMat = useArchMaterial('#1C2448', '#CFE0FF', '#CFE0FF', 0)
  const propMat = useArchMaterial('#232C55', '#8FB0FF', '#CFE0FF', 0)
  const emisMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FF3E9A', transparent: true, opacity: 0 }), [])

  const deckGeo = useMemo(() => {
    const g = new THREE.ShapeGeometry(platformShape(), 12)
    g.rotateX(-Math.PI / 2)
    g.translate(0, DECK_Y, 0)
    return g
  }, [])
  const floorMat = useMemo(() => {
    const marks = data.meta.floorMarks.map((m) => new THREE.Vector4(m[0], m[1], m[2], m[3]))
    while (marks.length < 3) marks.push(new THREE.Vector4())
    return new THREE.ShaderMaterial({
      vertexShader: floorVert,
      fragmentShader: floorFrag,
      uniforms: {
        ...U,
        uHallMin: { value: new THREE.Vector2(HALL.min[0], HALL.min[1]) },
        uHallMax: { value: new THREE.Vector2(HALL.max[0], HALL.max[1]) },
        uMarks: { value: marks.slice(0, 3) },
      },
    })
  }, [data])

  // blueprint linework: wall caps + wall bases, from the pipeline's wall segments
  const lines = useMemo(() => {
    const v: number[] = []
    // wall caps only: base lines lay 0.1 above the deck and z-fought it when seen from orbit.
    // A small depth bias keeps the caps in front of the wall tops they sit on, at any distance.
    for (const [x0, z0, x1, z1, h] of data.meta.walls) v.push(x0, h + 0.05, z0, x1, h + 0.05, z1)
    const m = glowLineMaterial({ color: '#E4F0FF', width: 2.2, opacity: 1, caps: true, bias: 1.5e-6, uniforms: { uReveal: U.uReveal, uDim: U.uDim }, ...CAP_HOOKS })
    return glowLines(glowLineGeometry(v), m)
  }, [data])

  const bulbs = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.bulbs, 3))
    const n = data.bulbs.length / 3
    const ph = new Float32Array(n)
    // light the curtain west→east so it "switches on" as a wave
    let minX = Infinity
    let maxX = -Infinity
    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, data.bulbs[i * 3])
      maxX = Math.max(maxX, data.bulbs[i * 3])
    }
    for (let i = 0; i < n; i++) ph[i] = ((data.bulbs[i * 3] - minX) / (maxX - minX)) * 0.8 + Math.random() * 0.2
    g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: bulbVert,
      fragmentShader: bulbFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...U, uDpr: { value: 1 } },
    })
    return { g, m }
  }, [data])

  useFrame(() => {
    const vis = S.reveal > 0.002
    if (group.current) group.current.visible = vis || S.morph > 0.5
    emisMat.opacity = S.reveal * (0.35 + 0.65 * S.lights) * (1 - S.dim * 0.5)
    bulbs.m.uniforms.uDpr.value = dpr
  })

  const { wall, furniture, prop, emissive } = data.meshes
  return (
    <>
      {/* the deck is part of the station: always there, the hall is drawn onto it */}
      <mesh geometry={deckGeo} material={floorMat} />
    <group ref={group}>
      {wall && <mesh geometry={wall} material={wallMat} />}
      {furniture && <mesh geometry={furniture} material={furnMat} />}
      {prop && <mesh geometry={prop} material={propMat} />}
      {emissive && <mesh geometry={emissive} material={emisMat} />}
      <primitive object={lines} />
      <points geometry={bulbs.g} material={bulbs.m} frustumCulled={false} />
    </group>
    </>
  )
}
