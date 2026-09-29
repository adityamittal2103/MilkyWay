'use client'
import { create } from 'zustand'

/**
 * Flicker diagnostic mode (developer only). Off unless the URL carries `?debug`, e.g.
 *   /explore?debug                       → panel only
 *   /explore?debug=nopost,staticcamera   → panel + those switches pre-set
 * The panel and probe are separate lazy chunks: normal visitors never download them.
 */
export const DEBUG_FLAGS = [
  { id: 'nopost', label: 'DEBUG_NO_POST' },
  { id: 'noparticles', label: 'DEBUG_NO_PARTICLES' },
  { id: 'noshadows', label: 'DEBUG_NO_SHADOWS' },
  { id: 'notransparency', label: 'DEBUG_NO_TRANSPARENCY' },
  { id: 'nolabels', label: 'DEBUG_NO_LABELS' },
  { id: 'novfx', label: 'DEBUG_NO_VFX' },
  { id: 'fixeddpr', label: 'DEBUG_FIXED_DPR' },
  { id: 'fixedquality', label: 'DEBUG_FIXED_QUALITY' },
  { id: 'staticcamera', label: 'DEBUG_STATIC_CAMERA' },
  { id: 'staticworld', label: 'DEBUG_STATIC_WORLD' },
] as const
export type DebugFlag = (typeof DEBUG_FLAGS)[number]['id']

type DebugState = {
  enabled: boolean
  flags: Record<DebugFlag, boolean>
  toggle: (f: DebugFlag, on?: boolean) => void
}

const none = Object.fromEntries(DEBUG_FLAGS.map((f) => [f.id, false])) as Record<DebugFlag, boolean>

export const useDebug = create<DebugState>((set, get) => ({
  enabled: false,
  flags: none,
  toggle: (f, on) => set({ flags: { ...get().flags, [f]: on ?? !get().flags[f] } }),
}))

/** Read once on boot. */
export function initDebug() {
  const q = new URLSearchParams(location.search)
  if (!q.has('debug')) return false
  const flags = { ...none }
  for (const id of (q.get('debug') ?? '').split(',')) if (id in flags) flags[id as DebugFlag] = true
  useDebug.setState({ enabled: true, flags })
  return true
}

/** Cheap per-frame read for render loops (no React). */
export const dbg = (f: DebugFlag) => useDebug.getState().flags[f]

/** Numbers the probe inside the canvas publishes for the panel (and the QA harness). */
export const stats = {
  fps: 0,
  frameMs: 0,
  worstMs: 0,
  dpr: 1,
  calls: 0,
  triangles: 0,
  points: 0,
  lines: 0,
  programs: 0,
  geometries: 0,
  textures: 0,
  post: false,
}
