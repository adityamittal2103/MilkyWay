'use client'
import * as THREE from 'three'
import { direct, type Targets } from '@/lib/director'
import { ZONES } from '@/data/zones'
import { CATEGORIES } from '@/data/categories'
import { PLANETS } from '@/data/planets'
import { EVENTS } from '@/data/provisional/events'
import { COLOR, QUALITY, type QualityProfile } from '@/lib/constants'
import { useWorld } from '@/lib/store'

/**
 * Per-frame world state shared by every 3D component.
 * `T` = raw targets from the director. `S` = smoothed values actually rendered.
 * Each channel has its own damping so things settle at different, intentional speeds.
 */
export const T: { current: Targets } = {
  current: direct({ mode: 'home', journey: 0, introDone: false, nav: { kind: 'system' }, selectedZone: null, hoveredZone: null, selectedCategory: null, selectedEvent: null, filter: 'all', mobile: false }),
}

export const S = {
  morph: 0,
  reveal: 0,
  lights: 0,
  sky: 0,
  sectionSky: 0,
  orbits: 0,
  dock: 0,
  dim: 0,
  galaxy: 0,
  cloud: 0,
  markers: 0,
  dust: 1,
  hyper: 0,
  planetLabels: 0,
  warp: 0,
  flight: 0,
  filterAmt: 0, // 0 = no filter, 1 = a filter is shaping the world
  chart: 0, // 0…1 share of the system charted while exploring: the universe responds
  zoneLight: new Float32Array(ZONES.length),
  zoneFocus: new Float32Array(ZONES.length),
  zoneHeat: new Float32Array(ZONES.length),
  catFocus: new Float32Array(CATEGORIES.length),
  catFilter: new Float32Array(CATEGORIES.length),
  planetHi: new Float32Array(PLANETS.length),
  evOn: new Float32Array(EVENTS.length).fill(1),
  evHot: new Float32Array(EVENTS.length),
  accent: new THREE.Color(COLOR.ion),
  time: 0,
}

export const damp = (a: number, b: number, lambda: number, dt: number) => a + (b - a) * (1 - Math.exp(-lambda * dt))

/**
 * Quality budgets without remounts: buffers are ALLOCATED once for the boot tier (useWorld bootTier);
 * each frame a component reads the CURRENT budget and shrinks its draw range / instance count.
 * A tier step-down therefore never recreates a geometry, a material or a shader program.
 */
export const budget = <K extends keyof QualityProfile>(k: K): QualityProfile[K] => QUALITY[useWorld.getState().tier][k]

/* Shared uniform objects: the same JS object is bound into several materials, so one write updates all. */
const hex = (h: string) => new THREE.Color(h)
export const U = {
  uTime: { value: 0 },
  uMorph: { value: 0 },
  uReveal: { value: 0 },
  uLights: { value: 0 },
  uDim: { value: 0 },
  uGlow: { value: 0 },
  uCloud: { value: 0 },
  uWarp: { value: 0 },
  uFlight: { value: 0 },
  uPointer: { value: new THREE.Vector3(0, 0, 0) },
  uPointerAmt: { value: 0 },
  uPointerNdc: { value: new THREE.Vector2() },
  uAccent: { value: S.accent },
  uFilterAmt: { value: 0 },
  uChart: { value: 0 },
  uZones: { value: ZONES.map((z) => new THREE.Vector4(z.rect[0], z.rect[1], z.rect[2], z.rect[3])) },
  uZoneLight: { value: Array.from(S.zoneLight) },
  uZoneFocus: { value: Array.from(S.zoneFocus) },
  uZoneHeat: { value: Array.from(S.zoneHeat) },
  uZoneColor: { value: ZONES.map((z) => hex(z.accent)) },
  uStarlight: { value: hex(COLOR.starlight) },
  uIon: { value: hex(COLOR.ion) },
  uPulsar: { value: hex(COLOR.pulsar) },
  uFlare: { value: hex(COLOR.flare) },
  uAbyss: { value: hex(COLOR.abyss) },
  uInk: { value: hex(COLOR.ink) },
  uDust: { value: hex(COLOR.dust) },
  uLumen: { value: hex(COLOR.lumen) },
  /** projection scale: pixels per world unit at distance 1 (for world-sized points) */
  uProj: { value: 1000 },
  uDpr: { value: 1 },
  /** drawing-buffer size in physical pixels (screen-space line widths) */
  uRes: { value: new THREE.Vector2(1, 1) },
  /** world reactions (lib/fx.ts): 0…1 envelopes */
  uFlash: { value: 0 }, // local stars / motes brighten (filter, planet select, discovery)
  uSurge: { value: 0 }, // venue lights surge (landing, filter)
  /** filter colour field: origin x, z, start time, speed (world units / s) */
  uFilterWave: { value: new THREE.Vector4(0, -5, -10, 320) },
  /** last click / landing shockwave */
  uPulse: { value: new THREE.Vector4(0, 0, 0, -10) },
  uPulseColor: { value: new THREE.Color(COLOR.ion) },
}

export const ZONE_COUNT = ZONES.length

/** GLSL block shared by materials that react to sectors. */
export const ZONE_GLSL = /* glsl */ `
  #define ZONES ${ZONES.length}
  uniform vec4 uZones[ZONES];
  uniform float uZoneLight[ZONES];
  uniform float uZoneFocus[ZONES];
  uniform float uZoneHeat[ZONES];
  uniform vec3 uZoneColor[ZONES];
  float rectMask(vec2 p, vec4 r, float soft) {
    vec2 a = smoothstep(r.xy - soft, r.xy + soft, p);
    vec2 b = 1.0 - smoothstep(r.zw - soft, r.zw + soft, p);
    return a.x * a.y * b.x * b.y;
  }
  float rectEdge(vec2 p, vec4 r, float w) {
    vec2 c = (r.xy + r.zw) * 0.5; vec2 h = (r.zw - r.xy) * 0.5;
    vec2 d = abs(p - c) - h;
    float outside = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    return 1.0 - smoothstep(0.0, w, abs(outside));
  }
`

/** Cheap value noise + fbm, shared by the procedural shaders (nebulae, planets, sky). */
export const NOISE_GLSL = /* glsl */ `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
    float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
  }
  float fbm3(vec3 p, int oct) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return s;
  }
`

/**
 * Antialiased patterns. A hard step() on a moving surface crawls and sparkles as the camera moves
 * (temporal aliasing reads as flicker). These are soft by one pixel and fade to their average once
 * the pattern gets finer than a few pixels, so they never shimmer at any distance.
 */
export const AA_GLSL = /* glsl */ `
  // 1 on a band covering 'duty' of each period of q (centred mid-period), 0 elsewhere
  float stripe(float q, float duty) {
    float fw = max(fwidth(q), 1e-5);
    float t = abs(fract(q) - 0.5);
    float on = 1.0 - smoothstep(0.5 * duty - fw, 0.5 * duty + fw, t);
    return mix(on, duty, smoothstep(0.18, 0.45, fw));
  }
  // a thin line at every integer of q (width in pattern units), fading out when sub-pixel
  float aaLine(float q, float width) {
    float fw = max(fwidth(q), 1e-5);
    float d = abs(fract(q + 0.5) - 0.5);
    float l = 1.0 - smoothstep(width * 0.5, width * 0.5 + fw * 1.5, d);
    return l * (1.0 - smoothstep(0.12, 0.4, fw));
  }
`

/**
 * Soft-particle helpers. A point smaller than ~3 physical px cannot be drawn stably: it covers 1–4
 * pixels depending on where it falls, so its brightness jumps as the camera moves and reads as
 * flicker (worse under bloom). Points never go below 3 px; the light they would have had is kept by
 * fading their alpha instead. (Measured: scripts/qa/flicker.mjs.)
 */
export const POINT_GLSL = /* glsl */ `
  uniform float uProj;
  uniform float uDpr;
  float worldPointSize(float worldSize, float viewDist) { return worldSize * uProj / max(viewDist, 1.0); }
  // returns the drawable size; scales alpha so sub-pixel points keep their brightness, not their pop
  // (px is physical pixels; below ~3 px a sprite covers 1–4 pixels depending on sub-pixel position,
  //  so its brightness jumps as it moves. pow 1.5 keeps the summed light close to the true size.)
  float stablePoint(float px, inout float alpha) {
    const float m = 3.0;
    if (px < m) { alpha *= pow(px / m, 1.5); return m; }
    return px;
  }
`
