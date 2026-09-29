'use client'
import { useCallback, useEffect, useRef } from 'react'
import { tween, EASE } from '@/lib/tween'
import { live, useWorld } from '@/lib/store'
import { lenis } from './SmoothScroll'

/**
 * WOW 01, the cold open. A title sequence, not a loading screen:
 *   0.00 black + radio  → 0.12 a warm point far away → 0.40 it's a ship, facing us →
 *   0.54 drift-flip → 0.64 anticipation → 0.82 boost + warp → 1.0 MILKY WAY.
 * Scroll, key or the Skip control fast-forwards. Returning visitors get a 2 s version.
 * Reduced motion: no sequence at all; the title is simply there.
 */
const PHASES = [0.1, 0.36, 0.6, 0.8] // → introPhase 1…4
const LINES = ['· · · signal', 'MW-01 Jugaad-1 · inbound', 'trajectory locked · milky way', '']

export function Intro() {
  const booted = useWorld((s) => s.booted)
  const mode = useWorld((s) => s.mode)
  const introDone = useWorld((s) => s.introDone)
  const phase = useWorld((s) => s.introPhase)
  const rm = useWorld((s) => s.reducedMotion)
  const webgl = useWorld((s) => s.webgl)
  const tl = useRef<{ cancel: () => void } | null>(null)

  const finish = useCallback(() => {
    tl.current?.cancel()
    const st = useWorld.getState()
    if (st.introDone) return
    tween(live, 'intro', 1, 0.9, EASE.power2Out, { onUpdate: syncPhase, onComplete: done })
  }, [])

  useEffect(() => {
    if (!booted || mode !== 'home' || introDone) return
    if (rm || !webgl) {
      live.intro = 1
      done()
      return
    }
    let seen = false
    try {
      seen = sessionStorage.getItem('mw-intro') === '1'
    } catch {}
    lenis?.stop()
    document.documentElement.style.overflow = 'hidden'
    live.intro = seen ? 0.5 : 0
    tl.current = tween(live, 'intro', 1, seen ? 2.4 : 7.4, EASE.none, { onUpdate: syncPhase, onComplete: done })
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && !['ArrowDown', 'PageDown', ' ', 'Enter', 'Escape'].includes(e.key)) return
      finish()
    }
    window.addEventListener('wheel', skip, { passive: true })
    window.addEventListener('touchmove', skip, { passive: true })
    window.addEventListener('keydown', skip)
    return () => {
      tl.current?.cancel()
      window.removeEventListener('wheel', skip)
      window.removeEventListener('touchmove', skip)
      window.removeEventListener('keydown', skip)
      document.documentElement.style.overflow = ''
      lenis?.start()
    }
  }, [booted, mode, introDone, rm, webgl, finish])

  if (mode !== 'home' || introDone || !booted) return null
  return (
    <div className="intro" aria-hidden={phase >= 4}>
      <p className="intro__radio mono" aria-live="polite">
        {LINES.slice(0, Math.min(phase + 1, 3)).map((l, i) => (
          <span key={l} className={i === Math.min(phase, 2) ? 'is-live' : ''}>
            {l}
          </span>
        ))}
      </p>
      <button type="button" className="intro__skip mono" onClick={finish} data-ui data-cursor="target">
        Skip intro ↓
      </button>
    </div>
  )
}

function syncPhase() {
  const p = PHASES.filter((x) => live.intro >= x).length
  const st = useWorld.getState()
  if (p !== st.introPhase) st.set({ introPhase: p })
}
function done() {
  live.intro = 1
  const st = useWorld.getState()
  st.set({ introDone: true, introPhase: 4 })
  try {
    sessionStorage.setItem('mw-intro', '1')
  } catch {}
  document.documentElement.style.overflow = ''
  lenis?.start()
}
