'use client'
/**
 * THE SIGNAL behind an artist transmission. One interface, three sources:
 *
 *   SyntheticSignal   deterministic maths from (seed, genre): no audio, no permission needed, and
 *                     the same seed always gives the same transmission. Used until the visitor
 *                     turns sound on, and for every artist without an audio file.
 *   AnalysedSignal    Web Audio AnalyserNode over a real source: the artist's own audio (track,
 *                     voice, interview, soundbite, performance excerpt, festival audio) or the
 *                     audible version of the synthetic transmission (SynthVoice, same pattern).
 *
 * Every source produces the same frame, which drives the portrait:
 *   bass → large-scale displacement · mid → contour motion · treble → fine particles
 *   amp → glow · transient → particle bursts · low energy → the image settles
 * We never fabricate an artist's audio: the synthetic signal is an abstract test transmission.
 */
export type SignalFrame = {
  bass: number
  mid: number
  treble: number
  amp: number
  transient: number
  /** time-domain shape, −1…1, 256 samples */
  wave: Float32Array
  /** 64 log-spaced bands, 0…1 */
  spec: Float32Array
  /** dominant frequency, Hz (readout) */
  freq: number
}
export interface Signal {
  readonly kind: 'synthetic' | 'analysed'
  readonly audible: boolean
  update(t: number, dt: number): SignalFrame
  dispose(): void
}

/** QA: ?signal=quiet|loud|bass|treble|slow shapes the synthetic source (and scales analysed ones). */
export type SignalMode = 'normal' | 'quiet' | 'loud' | 'bass' | 'treble' | 'slow'
export const signalMode = (): SignalMode => {
  if (typeof location === 'undefined') return 'normal'
  const m = new URLSearchParams(location.search).get('signal')
  return (['quiet', 'loud', 'bass', 'treble', 'slow'] as const).find((x) => x === m) ?? 'normal'
}
const MODE_GAIN: Record<SignalMode, [bass: number, mid: number, treble: number]> = {
  normal: [1, 1, 1],
  quiet: [0.14, 0.14, 0.14],
  loud: [1.7, 1.6, 1.6],
  bass: [1.8, 0.7, 0.25],
  treble: [0.25, 0.7, 1.9],
  slow: [1, 1, 1],
}

/* ───────────── a deterministic pattern: the "score" both the maths and the synth play */
export function rng(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export type Pattern = { bpm: number; kick: number[]; hat: number[]; bass: number[]; chord: number[]; speech: boolean }
export function makePattern(seed: number, genre: string, mode: SignalMode = 'normal'): Pattern {
  const r = rng(seed)
  const speech = genre === 'comedy' || genre === 'theatre'
  const base = { music: 124, dance: 118, fashion: 120, comedy: 96, theatre: 90 }[genre] ?? 110
  const bpm = (base + Math.round((r() - 0.5) * 8)) * (mode === 'slow' ? 0.5 : 1)
  const four = r() < 0.6
  const kick = Array.from({ length: 16 }, (_, i) => (four ? (i % 4 === 0 ? 1 : 0) : [0, 3, 6, 10, 12].includes(i) ? 1 : 0))
  const hat = Array.from({ length: 16 }, (_, i) => (i % 2 === 1 ? 1 : r() < 0.25 ? 0.6 : 0))
  const root = 33 + Math.floor(r() * 7) // A1…D#2
  const steps = [0, 0, 7, 0, 5, 0, 3, 0, 0, 0, 7, 10, 5, 0, 3, 2]
  const bass = Array.from({ length: 16 }, (_, i) => (r() < 0.7 ? root + steps[(i + Math.floor(r() * 3)) % 16] : -1))
  const minor = r() < 0.7
  const chord = [root + 24, root + 24 + (minor ? 3 : 4), root + 31, root + 34]
  return { bpm, kick, hat, bass, chord, speech }
}
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

/* ───────────── maths only (silent) */
export class SyntheticSignal implements Signal {
  readonly kind = 'synthetic' as const
  readonly audible = false
  private p: Pattern
  private g: [number, number, number]
  private r: () => number
  private frame: SignalFrame = { bass: 0, mid: 0, treble: 0, amp: 0, transient: 0, wave: new Float32Array(256), spec: new Float32Array(64), freq: 0 }
  private lastStep = -1
  private flash = 0
  constructor(seed: number, genre: string, mode: SignalMode = signalMode()) {
    this.p = makePattern(seed, genre, mode)
    this.g = MODE_GAIN[mode]
    this.r = rng(seed ^ 0x9e3779b9)
  }
  update(t: number, dt: number): SignalFrame {
    const { p, g, frame: f } = this
    const beat = (t * p.bpm) / 60
    const s16 = beat * 4
    const step = Math.floor(s16) % 16
    const ph = s16 - Math.floor(s16)
    let kick = 0
    let hat = 0
    let bassEnv = 0
    let note = p.bass[step] >= 0 ? p.bass[step] : p.chord[0] - 24
    if (p.speech) {
      // a voice: syllables at ~4–6 Hz in phrases, pauses between them
      const phrase = Math.sin(t * 0.9 + Math.sin(t * 0.37) * 2) * 0.5 + 0.5
      const syl = Math.pow(Math.max(0, Math.sin(t * 2 * Math.PI * (4.2 + Math.sin(t * 0.6)))), 2)
      bassEnv = syl * phrase * 0.6
      hat = syl * phrase * (0.4 + 0.4 * Math.sin(t * 13.1) ** 2)
      kick = phrase > 0.55 && ph < 0.1 && step % 8 === 0 ? 0.7 : 0
      note = 45 + Math.round(Math.sin(t * 1.3) * 3)
    } else {
      kick = p.kick[step] ? Math.exp(-ph * 7) : 0
      hat = p.hat[step] ? p.hat[step] * Math.exp(-ph * 22) : 0
      bassEnv = p.bass[step] >= 0 ? Math.exp(-ph * 2.2) * 0.7 : 0.1
    }
    if (step !== this.lastStep) {
      if (p.speech ? kick > 0 : p.kick[step] === 1) this.flash = 1 // an onset: the burst trigger
      this.lastStep = step
    }
    this.flash *= Math.exp(-dt * 14)
    const pad = 0.5 + 0.5 * Math.sin(t * 0.55) * Math.sin(t * 0.23 + 1)
    f.bass = clamp01((kick * 0.85 + bassEnv * 0.45) * g[0])
    f.mid = clamp01((0.22 + pad * 0.3 + bassEnv * 0.25) * g[1])
    f.treble = clamp01((hat * 0.75 + 0.06 + 0.06 * Math.sin(t * 7.7)) * g[2])
    f.amp = clamp01(f.bass * 0.42 + f.mid * 0.38 + f.treble * 0.3)
    f.transient = clamp01(this.flash * Math.max(g[0], 0.3))
    f.freq = hz(note)
    // waveform: bass fundamental + harmonics + pad partials + hiss, travelling in time
    const w = f.wave
    const fb = hz(note) / 55
    for (let i = 0; i < 256; i++) {
      const x = i / 255
      let v = Math.sin((x * 3 * fb + t * 1.7) * Math.PI * 2) * (0.25 + f.bass * 0.55)
      v += Math.sin((x * 6 * fb - t * 2.3) * Math.PI * 2) * 0.18 * f.mid
      for (let k = 0; k < p.chord.length; k++) v += Math.sin((x * (hz(p.chord[k]) / 40) + t * (0.6 + k * 0.2)) * Math.PI * 2) * 0.07 * f.mid
      v += (this.r() * 2 - 1) * 0.22 * f.treble
      w[i] = Math.max(-1, Math.min(1, v * (0.35 + f.amp)))
    }
    // spectrum: energy at the notes, the kick at the bottom, hats at the top, a noise floor
    const sp = f.spec
    for (let b = 0; b < 64; b++) {
      const fr = 30 * Math.pow(2, (b / 63) * 9) // 30 Hz … 15 kHz
      let e = 0.05 + 0.04 * this.r()
      e += f.bass * Math.exp(-Math.pow(Math.log2(fr / 60), 2) * 3)
      e += bassEnv * 0.8 * Math.exp(-Math.pow(Math.log2(fr / hz(note)), 2) * 8)
      for (const c of p.chord) e += f.mid * 0.35 * Math.exp(-Math.pow(Math.log2(fr / hz(c)), 2) * 18)
      e += f.treble * 0.7 * Math.exp(-Math.pow(Math.log2(fr / 8000), 2) * 1.2)
      sp[b] = clamp01(e)
    }
    return f
  }
  dispose() {}
}

/* ───────────── Web Audio analysis (real audio, or the audible synth) */
export class AnalysedSignal implements Signal {
  readonly kind = 'analysed' as const
  readonly audible: boolean
  private an: AnalyserNode
  private freqDb: Float32Array<ArrayBuffer>
  private time: Float32Array<ArrayBuffer>
  private prevSpec = new Float32Array(64)
  private fluxAvg = 0.02
  private g: [number, number, number]
  private frame: SignalFrame = { bass: 0, mid: 0, treble: 0, amp: 0, transient: 0, wave: new Float32Array(256), spec: new Float32Array(64), freq: 0 }
  private cleanup: () => void
  constructor(private ctx: AudioContext, source: AudioNode, opts: { audible: boolean; cleanup: () => void; mode?: SignalMode }) {
    this.an = ctx.createAnalyser()
    this.an.fftSize = 2048
    this.an.smoothingTimeConstant = 0.55
    source.connect(this.an)
    this.freqDb = new Float32Array(this.an.frequencyBinCount)
    this.time = new Float32Array(this.an.fftSize)
    this.audible = opts.audible
    this.cleanup = opts.cleanup
    this.g = MODE_GAIN[opts.mode ?? signalMode()]
  }
  update(_t: number, dt: number): SignalFrame {
    const f = this.frame
    this.an.getFloatFrequencyData(this.freqDb)
    this.an.getFloatTimeDomainData(this.time)
    const binHz = this.ctx.sampleRate / this.an.fftSize
    const band = (lo: number, hi: number) => {
      let s = 0
      let n = 0
      for (let i = Math.max(1, Math.floor(lo / binHz)); i <= Math.min(this.freqDb.length - 1, Math.ceil(hi / binHz)); i++) {
        s += Math.pow(10, this.freqDb[i] / 20)
        n++
      }
      return n ? s / n : 0
    }
    // perceptual scaling: each band has its own dBFS window (high bands carry far less energy per
    // bin than the bass, so one window would leave treble at zero and pin amplitude at full)
    const db = (x: number) => 20 * Math.log10(Math.max(x, 1e-7))
    const win = (x: number, lo: number, hi: number) => clamp01((db(x) - lo) / (hi - lo))
    const lvl = (x: number) => win(x, -70, -10)
    f.bass = clamp01(win(band(20, 160), -72, -18) * this.g[0])
    f.mid = clamp01(win(band(160, 2500), -82, -34) * this.g[1])
    f.treble = clamp01(win(band(2500, 12000), -92, -46) * this.g[2])
    let rms = 0
    for (const v of this.time) rms += v * v
    rms = Math.sqrt(rms / this.time.length)
    f.amp = clamp01(win(rms, -50, -6) * Math.max(...this.g))
    // waveform: 256 samples from the time domain, normalised gently so quiet audio still reads
    const step = this.time.length / 256
    const norm = 1 / Math.max(0.25, Math.min(1, rms * 4))
    for (let i = 0; i < 256; i++) f.wave[i] = Math.max(-1, Math.min(1, this.time[Math.floor(i * step)] * norm))
    // 64 log bands + spectral flux → transients (adaptive threshold)
    let flux = 0
    let peak = 0
    let peakHz = 0
    for (let b = 0; b < 64; b++) {
      const lo = 30 * Math.pow(2, (b / 64) * 9)
      const hi = 30 * Math.pow(2, ((b + 1) / 64) * 9)
      const v = lvl(band(lo, hi))
      flux += Math.max(0, v - this.prevSpec[b])
      this.prevSpec[b] = v
      f.spec[b] = v
      if (v > peak) {
        peak = v
        peakHz = Math.sqrt(lo * hi)
      }
    }
    this.fluxAvg += (flux - this.fluxAvg) * Math.min(1, dt * 2)
    const onset = flux > this.fluxAvg * 1.8 + 0.25 ? 1 : 0
    f.transient = Math.max(onset, f.transient * Math.exp(-dt * 14))
    f.freq = peakHz
    return f
  }
  dispose() {
    try {
      this.an.disconnect()
    } catch {}
    this.cleanup()
  }
}

/** The artist's own audio, analysed. Gain 0 keeps the analysis running while muted. */
export function audioFileSignal(ctx: AudioContext, url: string, audible: boolean): AnalysedSignal {
  const el = new Audio()
  el.crossOrigin = 'anonymous'
  el.src = url
  el.loop = true
  const src = ctx.createMediaElementSource(el)
  const gain = ctx.createGain()
  gain.gain.value = audible ? 0.9 : 0
  src.connect(gain)
  gain.connect(ctx.destination)
  el.play().catch(() => {})
  return new AnalysedSignal(ctx, src, {
    audible,
    cleanup: () => {
      el.pause()
      el.src = ''
      src.disconnect()
      gain.disconnect()
    },
  })
}

/**
 * The audible synthetic transmission: plays the same Pattern with Web Audio (kick, bass, pad,
 * hats or a vowel-ish "voice" for spoken genres) and hands it to the analyser, so the portrait is
 * driven by real analysed audio, not by the maths.
 */
export function synthSignal(ctx: AudioContext, seed: number, genre: string, mode: SignalMode = signalMode()): AnalysedSignal {
  const p = makePattern(seed, genre, mode)
  const out = ctx.createGain()
  out.gain.value = 0
  out.gain.setTargetAtTime(0.55, ctx.currentTime, 0.4)
  out.connect(ctx.destination)
  const bus = ctx.createGain()
  bus.connect(out)
  // pad: two detuned triangles per chord note → lowpass
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900
  lp.connect(bus)
  const pads = p.chord.map((m, i) => {
    const o = ctx.createOscillator()
    o.type = 'triangle'
    o.frequency.value = hz(m) * (i % 2 ? 1.003 : 0.997)
    const g = ctx.createGain()
    g.gain.value = p.speech ? 0.015 : 0.035
    o.connect(g)
    g.connect(lp)
    o.start()
    return o
  })
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  const r = rng(seed)
  for (let i = 0; i < nd.length; i++) nd[i] = r() * 2 - 1
  const stepDur = 60 / p.bpm / 4
  let next = ctx.currentTime + 0.05
  let step = 0
  const schedule = () => {
    while (next < ctx.currentTime + 0.15) {
      const t = next
      const s = step % 16
      if (p.speech) {
        // formant "syllables": filtered saw bursts, never words
        if (r() < 0.6) {
          const o = ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = 110 + r() * 60
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = 500 + r() * 1400
          bp.Q.value = 6
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.exponentialRampToValueAtTime(0.12, t + 0.03)
          g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.6)
          o.connect(bp)
          bp.connect(g)
          g.connect(bus)
          o.start(t)
          o.stop(t + stepDur * 1.8)
        }
      } else {
        if (p.kick[s]) {
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.frequency.setValueAtTime(140, t)
          o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
          g.gain.setValueAtTime(0.9, t)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
          o.connect(g)
          g.connect(bus)
          o.start(t)
          o.stop(t + 0.35)
        }
        if (p.hat[s]) {
          const n = ctx.createBufferSource()
          n.buffer = noiseBuf
          const hp = ctx.createBiquadFilter()
          hp.type = 'highpass'
          hp.frequency.value = 7000
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.32 * p.hat[s], t)
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
          n.connect(hp)
          hp.connect(g)
          g.connect(bus)
          n.start(t)
          n.stop(t + 0.06)
        }
        if (p.bass[s] >= 0) {
          const o = ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = hz(p.bass[s])
          const f = ctx.createBiquadFilter()
          f.type = 'lowpass'
          f.frequency.setValueAtTime(600, t)
          f.frequency.exponentialRampToValueAtTime(120, t + stepDur * 1.8)
          const g = ctx.createGain()
          g.gain.setValueAtTime(0.0001, t)
          g.gain.exponentialRampToValueAtTime(0.22, t + 0.01)
          g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 1.9)
          o.connect(f)
          f.connect(g)
          g.connect(bus)
          o.start(t)
          o.stop(t + stepDur * 2)
        }
      }
      next += stepDur
      step++
    }
  }
  schedule()
  const id = setInterval(schedule, 25)
  return new AnalysedSignal(ctx, bus, {
    audible: true,
    mode,
    cleanup: () => {
      clearInterval(id)
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
      setTimeout(() => {
        pads.forEach((o) => o.stop())
        out.disconnect()
      }, 600)
    },
  })
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
