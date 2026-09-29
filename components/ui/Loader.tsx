'use client'
import { useEffect, useState } from 'react'
import { useWorld } from '@/lib/store'

/**
 * Not "Loading…". The wait is explained: what is being built and how big it is.
 * Numbers are the real pipeline figures (docs/VENUE-PIPELINE.md). Progress is real bytes.
 * Server-rendered, zero assets: it paints instantly. A 9 s safety valve means it never traps anyone.
 */
const LOG = [
  { at: 0, text: 'Signal acquired · MW-01 Jugaad-1' },
  { at: 12, text: 'Unpacking Yashobhoomi floor plan · 3,653 objects' },
  { at: 35, text: 'Venue mesh · 109,064 tris (from 6.05 M)' },
  { at: 60, text: 'Plotting 60,000 stars of the barred spiral' },
  { at: 88, text: 'Calibrating trajectory' },
]

export function Loader() {
  const progress = useWorld((s) => s.progress)
  const ready = useWorld((s) => s.ready)
  const coreReady = useWorld((s) => s.coreReady)
  const mode = useWorld((s) => s.mode)
  const introDone = useWorld((s) => s.introDone)
  const webgl = useWorld((s) => s.webgl)
  const booted = useWorld((s) => s.booted)
  const [fonts, setFonts] = useState(false)
  const [minTime, setMinTime] = useState(false)

  useEffect(() => {
    document.fonts?.ready.then(() => setFonts(true))
    const a = setTimeout(() => setMinTime(true), 900)
    const b = setTimeout(() => useWorld.getState().set({ booted: true }), 9000)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  useEffect(() => {
    if (booted) return
    // the cold open only needs stars + the ship; the venue keeps streaming in behind it
    const enough = mode === 'home' && !introDone ? coreReady : ready
    if (!webgl || (enough && fonts && minTime)) {
      const t = setTimeout(() => useWorld.getState().set({ booted: true }), webgl ? 350 : 0)
      return () => clearTimeout(t)
    }
  }, [ready, coreReady, mode, introDone, fonts, minTime, webgl, booted])

  const p = webgl ? progress : 100
  return (
    <div className={`loader${booted ? ' is-done' : ''}`} role="status" aria-live="polite" aria-hidden={booted}>
      <div className="loader__inner">
        <svg className="loader__ship" viewBox="0 0 132 64" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
          <ellipse cx="60" cy="32" rx="40" ry="16" />
          <path d="M46 20 C50 10 62 10 66 19" />
          <path d="M92 26 L118 24 L122 32 L118 40 L92 38" />
          <path d="M28 36 L10 38 L8 32 L10 26 L28 28" />
          <line x1="40" y1="17" x2="30" y2="2" />
          <circle cx="30" cy="2" r="1.6" />
          <line x1="122" y1="32" x2="131" y2="32" stroke="var(--flare)" />
        </svg>
        <div className="loader__line">
          <p className="loader__title">Calibrating trajectory</p>
          <span className="mono" aria-label={`${p} percent`}>
            {String(p).padStart(3, '0')}%
          </span>
        </div>
        <div className="loader__bar" style={{ ['--p' as string]: p / 100 }}>
          <i />
        </div>
        <div className="loader__log mono">
          {LOG.filter((l) => p >= l.at).map((l) => (
            <span key={l.text}>› {l.text}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
