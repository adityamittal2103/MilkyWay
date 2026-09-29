'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { EVENTS } from '@/data/provisional/events'
import { CATEGORIES } from '@/data/categories'
import { ZONES } from '@/data/zones'
import { EVENT_ANCHORS } from '@/lib/director'
import { live, useWorld } from '@/lib/store'
import { setAnchor } from '@/lib/labels'
import { S, U, ZONE_GLSL } from './system'
import { glowLineGeometry, glowLineMaterial, glowLines } from './vfx/glowLines'

/**
 * Events live in the hall: every event is a pin in its sector. A stem rises from the floor to a
 * diamond node that pulses with its category colour. Filters dim what doesn't match; hover brings
 * up the reticle and a label; click flies the camera to it (explore / venue).
 */
const NODE_Y = 17
const N = EVENTS.length

EVENTS.forEach((e) => {
  const a = EVENT_ANCHORS.get(e.slug)!
  setAnchor(`evm:${e.slug}`, [a.x, NODE_Y + 5, a.z])
})

const nodeVert = /* glsl */ `
  attribute vec3 aColor; attribute float aOn; attribute float aHot; attribute float aSeed;
  uniform float uTime; uniform float uAmt; uniform float uProj; uniform float uDpr;
  varying vec3 vC; varying float vA; varying float vHot; varying float vPulse;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = (3.4 + aHot * 3.0) * (0.8 + aOn * 0.4);
    gl_PointSize = clamp(s * 2.6 * uProj / max(-mv.z, 1.0), 4.0 * uDpr, 64.0 * uDpr);
    vC = aColor; vA = uAmt * mix(0.25, 1.0, aOn); vHot = aHot;
    vPulse = fract(uTime * 0.6 + aSeed);
  }
`
const nodeFrag = /* glsl */ `
  varying vec3 vC; varying float vA; varying float vHot; varying float vPulse;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float dia = abs(c.x) + abs(c.y);                          // diamond
    float core = 1.0 - smoothstep(0.16, 0.2, dia);
    float frame = (1.0 - smoothstep(0.0, 0.03, abs(dia - 0.3))) * 0.9;
    float ring = (1.0 - smoothstep(0.0, 0.035, abs(length(c) - vPulse * 0.5))) * (1.0 - vPulse);
    float lock = vHot * (1.0 - smoothstep(0.0, 0.03, abs(max(abs(c.x), abs(c.y)) - 0.44))) * step(0.3, max(abs(c.x), abs(c.y)) * 2.0 - min(abs(c.x), abs(c.y)) * 2.0);
    float a = (core + frame * (0.5 + vHot * 0.5) + ring * 0.6 + lock) * vA;
    vec3 col = mix(vC, vec3(1.0), core * 0.35 + vHot * 0.3);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }
`
// the stems from the floor up to each marker (glow lines): brighter toward the top, hot when hovered
const STEM_HOOKS = {
  vertex: {
    head: 'attribute float aOn; attribute float aHot; uniform float uAmt; varying float vA;',
    body: 'vA = uAmt * mix(0.15, 0.7, aOn) * (1.0 + aHot); widthScale = 1.0 + aHot * 0.6; vCull = vA < 0.002 ? 1.0 : 0.0;',
  },
  fragment: { head: 'varying float vA;', body: 'a *= vA * (0.25 + vT * 0.75);' },
}

export function EventMarkers() {
  const size = useThree((s) => s.size)
  const camera = useThree((s) => s.camera)
  const amt = useMemo(() => ({ value: 0 }), [])
  const last = useRef<string | null>(null)
  const v = useMemo(() => new THREE.Vector3(), [])

  const nodes = useMemo(() => {
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const seed = new Float32Array(N)
    const c = new THREE.Color()
    EVENTS.forEach((e, i) => {
      const a = EVENT_ANCHORS.get(e.slug)!
      pos.set([a.x, NODE_Y, a.z], i * 3)
      c.set(CATEGORIES.find((x) => x.id === e.category)?.accent ?? '#CFE0FF')
      col.set([c.r, c.g, c.b], i * 3)
      seed[i] = (i * 0.37) % 1
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aOn', new THREE.BufferAttribute(new Float32Array(N).fill(1), 1))
    g.setAttribute('aHot', new THREE.BufferAttribute(new Float32Array(N), 1))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: U.uTime, uAmt: amt, uProj: U.uProj, uDpr: U.uDpr },
    })
    const sp: number[] = []
    const st: number[] = []
    EVENTS.forEach((e) => {
      const a = EVENT_ANCHORS.get(e.slug)!
      sp.push(a.x, 0.2, a.z, a.x, NODE_Y - 2, a.z)
      st.push(0, 1)
    })
    const sg = glowLineGeometry(sp, st, { aOn: { data: new Array(N).fill(1), size: 1 }, aHot: { data: new Array(N).fill(0), size: 1 } })
    const sm = glowLineMaterial({ color: '#CFE0FF', width: 1.8, uniforms: { uAmt: amt }, ...STEM_HOOKS })
    return { g, m, sg, sm, stems: glowLines(sg, sm) }
  }, [amt])

  useFrame(() => {
    amt.value = S.markers * S.reveal
    const on = nodes.g.getAttribute('aOn') as THREE.BufferAttribute
    const hot = nodes.g.getAttribute('aHot') as THREE.BufferAttribute
    const son = nodes.sg.getAttribute('aOn') as THREE.BufferAttribute
    const shot = nodes.sg.getAttribute('aHot') as THREE.BufferAttribute
    for (let i = 0; i < N; i++) {
      on.setX(i, S.evOn[i])
      hot.setX(i, S.evHot[i])
      son.setX(i, S.evOn[i])
      shot.setX(i, S.evHot[i])
    }
    on.needsUpdate = hot.needsUpdate = son.needsUpdate = shot.needsUpdate = true

    // hover: nearest node on screen (venue level only)
    const st = useWorld.getState()
    const venueLevel = st.mode === 'venue' || (st.mode === 'explore' && (st.nav.kind === 'venue' || st.nav.kind === 'zone' || st.nav.kind === 'event'))
    if (!venueLevel || st.coarse) {
      if (last.current && (st.mode === 'venue' || st.mode === 'explore')) {
        last.current = null
        st.set({ hoveredEvent: null })
      }
      return
    }
    let best: string | null = null
    let bd = 26
    if (live.pointer.active && live.pointer.overWorld && !live.orbit.dragging && amt.value > 0.5) {
      const p = nodes.g.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < N; i++) {
        if (S.evOn[i] < 0.5) continue
        v.set(p.getX(i), p.getY(i), p.getZ(i)).project(camera)
        if (v.z > 1) continue
        // hysteresis: the current target reads 30% closer, so neighbouring pins never flip-flop
        const d = Math.hypot(((v.x + 1) / 2) * size.width - live.pointer.px, ((1 - v.y) / 2) * size.height - live.pointer.py) * (EVENTS[i].slug === last.current ? 0.7 : 1)
        if (d < bd) {
          bd = d
          best = EVENTS[i].slug
        }
      }
    }
    if (best !== last.current) {
      last.current = best
      st.set({ hoveredEvent: best })
    }
    if (best) {
      live.hoverKind = 'event'
      live.hoverLabel = EVENTS.find((e) => e.slug === best)!.title
    }
  })

  return (
    <>
      <primitive object={nodes.stems} />
      <points geometry={nodes.g} material={nodes.m} frustumCulled={false} renderOrder={3} />
    </>
  )
}

/** Filter heat made visible: motes rise from sectors that match, like warmth off a stage. */
const heatVert = /* glsl */ `
  ${ZONE_GLSL}
  attribute vec3 aSeed; // zone index, rx, rz
  uniform float uTime; uniform float uAmt; uniform float uDpr; uniform float uProj;
  varying float vA;
  void main() {
    int zi = int(aSeed.x + 0.5);
    vec4 r = uZones[0]; float heat = 0.0;
    for (int i = 0; i < ZONES; i++) if (i == zi) { r = uZones[i]; heat = uZoneHeat[i]; }
    float life = fract(uTime * (0.08 + aSeed.y * 0.06) + aSeed.z);
    vec3 p = vec3(mix(r.x, r.z, aSeed.y), life * 70.0, mix(r.y, r.w, aSeed.z));
    p.x += sin(uTime * 0.7 + aSeed.z * 20.0) * 3.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = clamp(1.4 * uProj / max(-mv.z, 1.0), 0.0, 6.0 * uDpr);
    vA = uAmt * heat * sin(life * 3.14159);
    float m = 3.0; if (px < m) { vA *= pow(px / m, 1.5); px = m; } gl_PointSize = px; // never sub-pixel (see POINT_GLSL)
  }
`
const heatFrag = /* glsl */ `
  uniform vec3 uAccent;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    gl_FragColor = vec4(uAccent * a, a);
    #include <colorspace_fragment>
  }
`

export function HeatParticles() {
  const amt = useMemo(() => ({ value: 0 }), [])
  const { g, m } = useMemo(() => {
    const n = 900
    const seed = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) seed.set([i % ZONES.length, Math.random(), Math.random()], i * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3))
    const mat = new THREE.ShaderMaterial({ vertexShader: heatVert, fragmentShader: heatFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uAmt: amt } })
    return { g: geo, m: mat }
  }, [amt])
  useFrame(() => {
    amt.value = S.filterAmt * S.reveal
  })
  return <points geometry={g} material={m} frustumCulled={false} />
}
