'use client'
import type { Artist } from '@/data/artists'
import { audio } from '@/lib/audio'
import { AnalysedSignal, SyntheticSignal, audioFileSignal, synthSignal, type Signal, type SignalFrame } from './signal'

/**
 * One transmission at a time. The 3D scene and the DOM both read this: the clock (seconds since
 * the signal was detected), the stage, and the current signal frame. Nothing here renders.
 *
 * Timeline (tuned by eye, not a slideshow: stages overlap and particles arrive individually)
 *   0 SIGNAL       0.0–1.1  a distant marker, a few particles
 *   1 NOISE        1.1–2.2  static
 *   2 LOCK         2.2–3.5  the static collapses onto the live carrier waveform
 *   3 STRUCTURE    3.5–4.8  the carrier splits into scanline strands: the face as a ridge plot
 *   4 CONTOURS     4.8–6.0  edge particles lock first: eyes, nose, mouth, jaw, hair
 *   5 IDENTITY     6.0–7.2  everything lands; the relief appears
 *   6 STABLE       7.2+     the portrait breathes with the signal
 */
export const STAGES = [
  { at: 0, code: 'SIGNAL', line: 'Carrier detected on the outer arm' },
  { at: 1.1, code: 'NOISE', line: 'Static from the galactic core' },
  { at: 2.2, code: 'FREQUENCY LOCK', line: 'Locking the carrier' },
  { at: 3.5, code: 'STRUCTURE', line: 'Structure in the noise' },
  { at: 4.8, code: 'CONTOURS', line: 'Contours resolving' },
  { at: 6.0, code: 'IDENTITY', line: 'Identity reconstructed' },
  { at: 7.2, code: 'STABLE', line: 'Transmission stable' },
] as const
export const STABLE_AT = 7.2
export const stageAt = (t: number) => {
  let s = 0
  for (let i = 0; i < STAGES.length; i++) if (t >= STAGES[i].at) s = i
  return s
}

const empty = (): SignalFrame => ({ bass: 0, mid: 0, treble: 0, amp: 0, transient: 0, wave: new Float32Array(256), spec: new Float32Array(64), freq: 0 })

export const tx = {
  artist: null as Artist | null,
  t: 0,
  running: false,
  /** the portrait cloud is loaded (the sequence waits for it, so no step is ever skipped) */
  ready: false,
  frame: empty(),
  signal: null as Signal | null,
  listening: false,
  /** bumped on replay so the scene can reset per-particle state */
  run: 0,
}

export function startTransmission(a: Artist, opts: { skip?: boolean } = {}) {
  stopTransmission()
  tx.artist = a
  tx.t = opts.skip ? STABLE_AT + 0.8 : 0
  tx.running = true
  tx.ready = false
  tx.run++
  tx.signal = new SyntheticSignal(a.transmissionSeed, a.genre)
  // the site's sound is on: listen straight away (the visitor already opted in)
  if (audio.on) setListening(true)
}

export function replayTransmission() {
  if (!tx.artist) return
  tx.t = 0
  tx.run++
}

/** Sound on → the signal is heard, and the analyser (not the maths) drives the portrait. */
export function setListening(on: boolean) {
  const a = tx.artist
  if (!a) return
  if (on === tx.listening && tx.signal) return
  tx.signal?.dispose()
  tx.listening = on
  if (!on) {
    tx.signal = new SyntheticSignal(a.transmissionSeed, a.genre)
    return
  }
  const ctx = ensureContext()
  if (!ctx) {
    tx.listening = false
    tx.signal = new SyntheticSignal(a.transmissionSeed, a.genre)
    return
  }
  tx.signal = a.audio ? audioFileSignal(ctx, a.audio, true) : synthSignal(ctx, a.transmissionSeed, a.genre)
}

export function stopTransmission() {
  tx.signal?.dispose()
  tx.signal = null
  tx.running = false
  tx.listening = false
  tx.artist = null
  tx.frame = empty()
}

/** Advance the clock and sample the signal (called once per frame by the scene). */
export function stepTransmission(dt: number) {
  if (!tx.running || !tx.signal) return tx.frame
  // hold at the first beat until the portrait is ready: the reveal is never partially skipped
  if (tx.ready || tx.t < 0.9) tx.t += dt
  tx.frame = tx.signal.update(tx.t, dt)
  return tx.frame
}

export const isAnalysed = () => tx.signal instanceof AnalysedSignal

let ctxRef: AudioContext | null = null
function ensureContext(): AudioContext | null {
  try {
    if (!ctxRef) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctxRef = new AC()
    }
    ctxRef.resume().catch(() => {})
    return ctxRef
  } catch {
    return null
  }
}
