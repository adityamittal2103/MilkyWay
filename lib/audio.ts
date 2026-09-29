'use client'
/**
 * Optional procedural sound (WOW 11). No audio files: everything is synthesised, so it costs
 * zero bytes until the visitor opts in. Nothing here is ever needed to understand the site.
 *  - engine hum: two detuned saws → lowpass; pitch + cutoff follow travel speed
 *  - radio: filtered noise with slow sweeps (the "deep space" bed)
 *  - pings on hover/selection, a whoosh on jumps
 */
class Audio {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  hum: { o1: OscillatorNode; o2: OscillatorNode; f: BiquadFilterNode; g: GainNode } | null = null
  radio: { f: BiquadFilterNode; g: GainNode } | null = null
  on = false
  lastPing = 0

  start() {
    if (typeof window === 'undefined') return
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      const master = ctx.createGain()
      master.gain.value = 0
      master.connect(ctx.destination)
      // engine
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = 220
      f.Q.value = 6
      const g = ctx.createGain()
      g.gain.value = 0.08
      const o1 = ctx.createOscillator()
      const o2 = ctx.createOscillator()
      o1.type = 'sawtooth'
      o2.type = 'sawtooth'
      o1.frequency.value = 48
      o2.frequency.value = 48.6
      o1.connect(f)
      o2.connect(f)
      f.connect(g)
      g.connect(master)
      o1.start()
      o2.start()
      // radio bed
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02 // brown-ish
        d[i] = last * 3.5
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const rf = ctx.createBiquadFilter()
      rf.type = 'bandpass'
      rf.frequency.value = 900
      rf.Q.value = 3
      const rg = ctx.createGain()
      rg.gain.value = 0.05
      src.connect(rf)
      rf.connect(rg)
      rg.connect(master)
      src.start()
      this.ctx = ctx
      this.master = master
      this.hum = { o1, o2, f, g }
      this.radio = { f: rf, g: rg }
    }
    this.ctx.resume()
    this.on = true
    this.master!.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.6)
  }

  stop() {
    this.on = false
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25)
  }

  /** speed 0…1 */
  tick(speed: number, t: number) {
    if (!this.on || !this.ctx || !this.hum || !this.radio) return
    const now = this.ctx.currentTime
    this.hum.o1.frequency.setTargetAtTime(44 + speed * 40, now, 0.15)
    this.hum.o2.frequency.setTargetAtTime(44.7 + speed * 41, now, 0.15)
    this.hum.f.frequency.setTargetAtTime(160 + speed * 900, now, 0.2)
    this.radio.f.frequency.setTargetAtTime(700 + Math.sin(t * 0.13) * 500 + Math.sin(t * 0.71) * 160, now, 0.4)
  }

  ping(pitch = 1) {
    if (!this.on || !this.ctx || !this.master) return
    const now = this.ctx.currentTime
    if (now - this.lastPing < 0.06) return
    this.lastPing = now
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(880 * pitch, now)
    o.frequency.exponentialRampToValueAtTime(1320 * pitch, now + 0.08)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.06, now + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
    o.connect(g)
    g.connect(this.master)
    o.start(now)
    o.stop(now + 0.3)
  }

  /** destination confirmed: two soft rising tones */
  engage() {
    if (!this.on || !this.ctx || !this.master) return
    const now = this.ctx.currentTime
    ;[0, 0.09].forEach((d, i) => {
      const o = this.ctx!.createOscillator()
      const g = this.ctx!.createGain()
      o.type = 'triangle'
      o.frequency.setValueAtTime(i ? 660 : 440, now + d)
      g.gain.setValueAtTime(0.0001, now + d)
      g.gain.exponentialRampToValueAtTime(0.05, now + d + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.3)
      o.connect(g)
      g.connect(this.master!)
      o.start(now + d)
      o.stop(now + d + 0.35)
    })
  }

  /** touchdown: a low thump with a little air */
  land() {
    if (!this.on || !this.ctx || !this.master) return
    const now = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, now)
    o.frequency.exponentialRampToValueAtTime(42, now + 0.35)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6)
    o.connect(g)
    g.connect(this.master)
    o.start(now)
    o.stop(now + 0.7)
  }

  /** a small confirmation blip (filters, selections) */
  confirm(pitch = 1) {
    this.ping(pitch * 0.75)
  }

  whoosh() {
    if (!this.on || !this.ctx || !this.master) return
    const ctx = this.ctx
    const now = ctx.currentTime
    const len = ctx.sampleRate * 1.6
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.2
    f.frequency.setValueAtTime(200, now)
    f.frequency.exponentialRampToValueAtTime(3200, now + 0.65)
    f.frequency.exponentialRampToValueAtTime(300, now + 1.5)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, now)
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
    src.connect(f)
    f.connect(g)
    g.connect(this.master)
    src.start(now)
  }
}

export const audio = new Audio()
