'use client'
import { useEffect, useRef } from 'react'
import { live, useWorld } from '@/lib/store'

/**
 * WOW 02 (type half). MILKY WAY in Anybody's variable width axis:
 * condensed at rest, stretching like light as speed builds (scroll thrust, warp, intro boost).
 * Letters near the pointer swell slightly and lean away (gravity on type), always legible.
 */
export function KineticWordmark({ lines, className = '', show = true }: { lines: string[]; className?: string; show?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const letters = Array.from(el.querySelectorAll<HTMLElement>('.kw__ch'))
    let raf = 0
    let w = 60
    let cachedW = -1
    let base: { x: number; y: number }[] = []
    // letter centres relative to the wordmark (offsets ignore transforms → no layout feedback)
    const measure = () => {
      base = letters.map((l) => {
        const line = l.parentElement as HTMLElement
        return { x: line.offsetLeft + l.offsetLeft + l.offsetWidth / 2, y: line.offsetTop + l.offsetTop + l.offsetHeight / 2 }
      })
      cachedW = w
    }
    window.addEventListener('resize', measure)
    document.fonts?.ready.then(measure)
    const rm = useWorld.getState().reducedMotion
    const fine = window.matchMedia('(pointer: fine)').matches
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const speed = rm ? 0 : Math.min(1, live.speed * 1.4 + live.warp)
      const introBoost = rm ? 0 : Math.sin(Math.min(1, Math.max(0, (live.intro - 0.62) / 0.3)) * Math.PI) * (live.intro < 1 ? 1 : 0)
      w += (58 + Math.max(speed, introBoost) * 92 - w) * 0.12
      el.style.setProperty('--wdth', w.toFixed(1))
      if (!fine || rm) return
      if (Math.abs(w - cachedW) > 3 || base.length !== letters.length) measure()
      const box = el.getBoundingClientRect()
      const px = live.pointer.px
      const py = live.pointer.py
      for (let i = 0; i < letters.length; i++) {
        const l = letters[i]
        const cx = box.left + base[i].x
        const cy = box.top + base[i].y
        const dx = cx - px
        const dy = cy - py
        const d = Math.hypot(dx, dy)
        const f = live.pointer.active ? Math.exp(-(d * d) / 42000) : 0
        l.style.transform = `translate3d(${((dx / (d + 1)) * f * 10).toFixed(2)}px, ${((dy / (d + 1)) * f * 6).toFixed(2)}px, 0)`
        l.style.setProperty('--lw', (f * 24).toFixed(1))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [])

  let n = 0
  return (
    <span ref={ref} className={`kw ${show ? 'is-in' : ''} ${className}`}>
      {lines.map((line) => (
        <span className="kw__line" key={line}>
          {line.split('').map((ch, i) => (
            <span className="kw__ch" key={i} style={{ ['--n' as string]: n++ }} aria-hidden="true">
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
      ))}
      <span className="sr-only">{lines.join(' ')}</span>
    </span>
  )
}
