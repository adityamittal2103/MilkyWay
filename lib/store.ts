'use client'
import { create } from 'zustand'
import type { Tier } from './constants'

/**
 * Two kinds of state:
 *  - `useWorld` (zustand): discrete, UI-relevant state that React renders from.
 *  - `live` (plain mutable object): per-frame values (scroll, pointer, warp, flight) read inside
 *    useFrame / rAF loops. Never put these in React state; they change 60×/s.
 */

export type Mode = 'home' | 'explore' | 'venue' | 'events' | 'competitions' | 'schedule' | 'artists' | 'register' | 'page'

/** Where the navigable camera is headed (explore + venue). */
export type NavTarget =
  | { kind: 'space' }
  | { kind: 'galaxy' }
  | { kind: 'system' }
  | { kind: 'planet'; id: string }
  | { kind: 'venue' }
  | { kind: 'zone'; id: string }
  | { kind: 'event'; id: string }

type WorldState = {
  mode: Mode
  /** the tier budgets are allocated for at boot (buffers, post pipeline); never changes */
  bootTier: Tier
  /** the current budget: may step DOWN at runtime (draw ranges shrink, nothing remounts) */
  tier: Tier
  tierLocked: boolean // ?quality= override: never auto-adjust
  webgl: boolean
  reducedMotion: boolean
  coarse: boolean // touch-first device
  ready: boolean // venue assets decoded + shaders compiled
  coreReady: boolean // the canvas has drawn its first frame (enough for the void + cold open)
  progress: number // 0–100 asset progress
  booted: boolean // loader finished (assets + fonts, or no-WebGL fallback)
  introDone: boolean
  introPhase: number // 0 dark · 1 signal · 2 ship · 3 warp · 4 title
  navOpen: boolean
  filterOpen: boolean
  sound: boolean
  filter: string // lib/filter.ts id
  nav: NavTarget
  hoveredZone: string | null
  selectedZone: string | null
  hoveredCategory: string | null
  selectedCategory: string | null
  hoveredEvent: string | null
  selectedEvent: string | null
  hoveredPlanet: string | null
  hoveredConstellation: string | null
  day: number | null
  filterZone: string | null
  transition: { active: boolean; label: string; href: string | null }
  /** the artist transmission playing (on /artists/[id]) */
  transmission: string | null
  shipTricks: number
  discovered: string[] // places and secrets found while exploring (progression)
  lore: { title: string; body: string } | null
  set: (p: Partial<WorldState>) => void
  discover: (id: string) => void
}

export const useWorld = create<WorldState>((set, get) => ({
  mode: 'home',
  bootTier: 'medium',
  tier: 'medium',
  tierLocked: false,
  webgl: true,
  reducedMotion: false,
  coarse: false,
  ready: false,
  coreReady: false,
  progress: 0,
  booted: false,
  introDone: false,
  introPhase: 0,
  navOpen: false,
  filterOpen: false,
  sound: false,
  filter: 'all',
  nav: { kind: 'system' },
  hoveredZone: null,
  selectedZone: null,
  hoveredCategory: null,
  selectedCategory: null,
  hoveredEvent: null,
  selectedEvent: null,
  hoveredPlanet: null,
  hoveredConstellation: null,
  day: null,
  filterZone: null,
  transition: { active: false, label: '', href: null },
  transmission: null,
  shipTricks: 0,
  discovered: [],
  lore: null,
  set: (p) => set(p),
  discover: (id) => {
    const d = get().discovered
    if (d.includes(id)) return
    const next = [...d, id]
    set({ discovered: next })
    try {
      localStorage.setItem('mw-discovered', JSON.stringify(next))
    } catch {}
  },
}))

/** What kind of 3D thing is under the pointer: drives the reticle system. */
export type HoverKind = 'zone' | 'planet' | 'event' | 'ship' | 'star' | 'constellation' | 'transmission' | null

/**
 * Who owns the camera this frame (one authority, strict priority):
 *   system    reduced motion / resize settle: snap, no travel
 *   flight    a planned flight is running: autopilot, user input is held
 *   cinematic scroll (home journey) or a route preset drives it
 *   user      explore / venue: the visitor pilots (keys, drag, wheel, touch)
 *   idle      user mode with no input for a while: a slow drift
 */
export type CamState = 'system' | 'flight' | 'cinematic' | 'user' | 'idle'

export const live = {
  /** home journey progress 0…1 (Lenis-smoothed) */
  journey: 0,
  /** smoothed scroll velocity, px/frame-ish, signed */
  scrollVel: 0,
  /** 0…1 overall "speed" used by ship engine, wordmark width, audio */
  speed: 0,
  /** route-change warp envelope 0…1 */
  warp: 0,
  /** camera flight envelope 0…1 (explore travel, landing) */
  flight: 0,
  /** intro title sequence progress 0…1 */
  intro: 0,
  /** ndc x/y, pixel px/py; overWorld = not over a UI panel, so the 3D world may react */
  pointer: { x: 0, y: 0, px: 0, py: 0, active: false, overWorld: false, down: false },
  /** pointer hit on the hall floor (world) */
  floor: { x: 0, z: 0, hit: false },
  /** camera speed, world units / s */
  camSpeed: 0,
  /** camera altitude above the hall floor (world units) */
  alt: 0,
  /** camera position + heading for the radar (world) */
  cam: { x: 0, y: 0, z: 0, heading: 0 },
  /** set by the scene when a 3D object is under the cursor → reticle state */
  hover3D: false,
  hoverKind: null as HoverKind,
  hoverLabel: '',
  /** the world clock (seconds), shared with shaders via S.time */
  clock: 0,
  /** a click/landing pulse to render: world position + time */
  pulse: { x: 0, y: 0, z: 0, t: -10, color: '#5B8CFF' },
  /** user camera offsets in navigable modes (drag orbit / wheel zoom) */
  orbit: { az: 0, pol: 0, zoom: 1, dragging: false },
  /**
   * Pilot input, written by NavInput (DOM) and consumed by the CameraRig (the only camera writer).
   * f/r/u: held keys as axes (W/S forward, D/A strafe, E/Q up), zoom: +/- keys, boost: Shift.
   * panX/panY: pixel deltas from two-finger / right-button drags, zeroed once consumed.
   * reset: bumped by R (return to the exploration orientation).
   */
  input: { f: 0, r: 0, u: 0, zoom: 0, boost: false, panX: 0, panY: 0, reset: 0, last: 0 },
  /** the pilot's movement, camera-local and normalised to max speed (−1…1): drives ship attitude + FX */
  pilot: { f: 0, r: 0, u: 0, speed: 0 },
  camState: 'cinematic' as CamState,
  /** named camera view for diagnostics (SPACE · GALAXY · … · EVENT) */
  camView: '',
  /** adaptive quality governor readout: state + why it is (not) judging */
  quality: { state: 'warmup', reason: '' },
  /** > 0 while a cinematic sequence (e.g. an artist transmission) must not be disturbed by quality changes */
  qualityHold: 0,
}
