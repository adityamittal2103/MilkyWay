'use client'
import { useEffect, useRef } from 'react'
import { live, useWorld } from '@/lib/store'

/** The portal you pass through on every route change. Driven by live.warp, no React renders per frame. */
export function JumpOverlay() {
  const ref = useRef<HTMLDivElement>(null)
  const label = useWorld((s) => s.transition.label)
  const active = useWorld((s) => s.transition.active)

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const w = live.warp
      const el = ref.current
      if (!el) return
      el.style.setProperty('--jump-o', String(Math.min(1, w * 1.6)))
      el.style.setProperty('--jump-s', String(0.15 + w * w * 3.2))
      el.style.setProperty('--jump-w', String(w))
      el.style.setProperty('--jump-f', String(Math.max(0, (w - 0.75) * 4) * 0.8))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
    <div ref={ref} className="jump" aria-hidden="true">
      <div className="jump__flash" />
      <div className="jump__ring" />
      <div className="jump__ring jump__ring--2" />
      {active && (
        <div className="jump__label">
          <span className="mono dust">Jumping to</span>
          <span className="jump__to">{label}</span>
        </div>
      )}
    </div>
    <p className="sr-only" aria-live="polite">
      {active ? `Navigating to ${label}` : ''}
    </p>
    </>
  )
}
