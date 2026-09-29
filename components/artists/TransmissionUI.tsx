'use client'
import { useEffect, useRef, useState } from 'react'
import { useWorld } from '@/lib/store'
import { transmissionById } from '@/data/artists'
import { categoryById } from '@/data/categories'
import { zoneById } from '@/data/zones'
import { PROVISIONAL_DAYS } from '@/data/provisional/events'
import { STABLE_AT, STAGES, replayTransmission, setListening, stageAt, startTransmission, stepTransmission, stopTransmission, tx } from '@/lib/transmission/controller'
import { audio } from '@/lib/audio'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { StaticPortrait } from './StaticPortrait'

/**
 * The DOM half of a transmission: stage lines, the small signal metadata, and (once the face is
 * reconstructed) the practical information and actions. The information is in the page from the
 * first paint (screen readers and search engines read it immediately); it is only VISUALLY
 * revealed after the reconstruction, and immediately with reduced motion.
 */
const pad = (n: number, l = 3) => String(n).padStart(l, '0')

export function TransmissionUI({ id }: { id: string }) {
  const a = transmissionById(id)!
  const webgl = useWorld((s) => s.webgl)
  const reduced = useWorld((s) => s.reducedMotion)
  const [stage, setStage] = useState(0)
  const [listening, setListen] = useState(false)
  const stageRef = useRef(-1)
  const freq = useRef<HTMLSpanElement>(null)
  const amp = useRef<HTMLSpanElement>(null)
  const lock = useRef<HTMLSpanElement>(null)
  const bands = useRef<HTMLSpanElement>(null)
  const index = parseInt(a.id.replace(/\D/g, ''), 10) || 1
  const signalId = `MW-TX-${pad(index)}·${a.transmissionSeed.toString(16).toUpperCase().padStart(4, '0')}`
  const zone = zoneById(a.venue)
  const cat = categoryById(a.genre)
  const day = a.day != null ? PROVISIONAL_DAYS[a.day] : null

  useEffect(() => {
    useWorld.getState().set({ transmission: a.id })
    startTransmission(a, { skip: reduced })
    if (new URLSearchParams(location.search).has('qa')) (window as unknown as { __mwtx: typeof tx }).__mwtx = tx
    return () => {
      stopTransmission()
      useWorld.getState().set({ transmission: null })
    }
  }, [a, reduced])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // without WebGL there is no scene to drive the clock: the page drives it
      if (!useWorld.getState().webgl) {
        tx.ready = true
        stepTransmission(dt)
      }
      const s = stageAt(tx.t)
      if (s !== stageRef.current) {
        stageRef.current = s
        setStage(s)
      }
      const f = tx.frame
      if (freq.current) freq.current.textContent = `${f.freq ? Math.round(f.freq) : '—'} Hz`
      if (amp.current) amp.current.textContent = `${f.amp > 0.001 ? (20 * Math.log10(Math.max(f.amp, 0.001)) * 0.6).toFixed(1) : '−∞'} dB`
      if (lock.current) {
        const k = Math.min(1, Math.max(0, (tx.t - 2.1) / (STABLE_AT - 2.1)))
        lock.current.textContent = tx.t < 2.1 ? 'searching' : k < 1 ? `decoding ${Math.round(k * 100)}%` : 'locked'
      }
      if (bands.current) bands.current.textContent = `B ${pad(Math.round(f.bass * 99), 2)} · M ${pad(Math.round(f.mid * 99), 2)} · T ${pad(Math.round(f.treble * 99), 2)}`
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const stable = stage >= STAGES.length - 1
  const toggleListen = () => {
    const on = !listening
    setListen(on)
    setListening(on)
    if (on && !audio.on) {
      // listening to a transmission turns the site's sound on too (one switch, one mental model)
      audio.start()
      useWorld.getState().set({ sound: true })
      try {
        localStorage.setItem('mw-sound', '1')
      } catch {}
    }
  }

  return (
    <div className={`tx-view${stable ? ' is-stable' : ''}${webgl ? '' : ' tx-view--static'}`} data-cursor-scope="transmission">
      <div className="tx-view__signal mono" aria-hidden="true">
        <span className="tx-view__code">{signalId}</span>
        <span className="tx-view__stage" key={stage}>
          <b>{STAGES[stage].code}</b> {STAGES[stage].line}
        </span>
      </div>

      <dl className="tx-meta mono" aria-hidden="true">
        <div>
          <dt>Frequency</dt>
          <dd ref={freq}>—</dd>
        </div>
        <div>
          <dt>Amplitude</dt>
          <dd ref={amp}>—</dd>
        </div>
        <div>
          <dt>Bands</dt>
          <dd ref={bands}>—</dd>
        </div>
        <div>
          <dt>Signal ID</dt>
          <dd>{signalId}</dd>
        </div>
        <div>
          <dt>Origin</dt>
          <dd>{zone ? `${zone.code} ${zone.name}` : 'Yashobhoomi'}</dd>
        </div>
        <div>
          <dt>Lock</dt>
          <dd ref={lock}>searching</dd>
        </div>
      </dl>

      {!webgl && a.image && <StaticPortrait artist={a} />}

      <section className="tx-info" aria-label={`${a.name}: artist information`}>
        {a.provisional && <p className="tx-info__flag mono">Test transmission · artist to be announced</p>}
        <p className="tx-info__kind mono">{cat?.name ?? a.genre}</p>
        <h1 className="tx-info__name">{a.name}</h1>
        <dl className="tx-info__facts">
          <div>
            <dt className="mono">Date</dt>
            <dd>{day ? (day.date ?? day.label) : 'On transmission'}</dd>
          </div>
          <div>
            <dt className="mono">Time</dt>
            <dd>{a.time ?? 'On transmission'}</dd>
          </div>
          <div>
            <dt className="mono">Venue</dt>
            <dd>
              {zone ? (
                <TransitionLink href={`/venue?zone=${zone.id}`} label={`Land at ${zone.name}`} className="tx-info__venue">
                  {zone.code} · {zone.name}
                </TransitionLink>
              ) : (
                'Yashobhoomi'
              )}
            </dd>
          </div>
        </dl>
        {a.description && <p className="tx-info__desc">{a.description}</p>}
        <div className="tx-info__actions">
          {a.event && (
            <TransitionLink href={`/events/${a.event}`} label="View performance" className="go go--ion" cursor="destination" data-cursor-label="VIEW">
              View performance <span className="go__arrow">→</span>
            </TransitionLink>
          )}
          <TransitionLink href="/register" label="Board the Milky Way" className="board" cursor="register" data-cursor-label="BOARD">
            <span className="board__flame" aria-hidden="true" />
            Register
          </TransitionLink>
          <button type="button" className="go" onClick={() => replayTransmission()} data-cursor="transmission" data-cursor-label="REPLAY">
            Replay transmission <span className="go__arrow">↺</span>
          </button>
        </div>
      </section>

      <div className="tx-view__controls">
        <button type="button" className={`tx-listen mono${listening ? ' is-on' : ''}`} onClick={toggleListen} aria-pressed={listening} data-cursor="transmission" data-cursor-label={listening ? 'MUTE' : 'LISTEN'}>
          <span className="tx-listen__bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          {listening ? 'Listening' : 'Listen'}
          <span className="dust">{a.audio ? ` · ${a.audioKind ?? 'audio'}` : ' · synthetic signal'}</span>
        </button>
        <TransitionLink href="/artists" label="Transmissions" className="tx-back mono" cursor="target">
          ← All transmissions
        </TransitionLink>
      </div>
    </div>
  )
}
