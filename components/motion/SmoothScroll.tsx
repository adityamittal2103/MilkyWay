'use client'
import { useEffect } from 'react'
import Lenis from 'lenis'
import { live, useWorld } from '@/lib/store'

/**
 * Smooth scroll turns wheel ticks into continuous velocity, which is what makes scroll feel
 * like thrust (ship engine, star streaks, wordmark width all read `live.scrollVel`).
 * Native scroll is kept, with no pinning or hijacking. Reduced motion → no Lenis at all.
 */
export let lenis: Lenis | null = null

export function SmoothScroll() {
  const rm = useWorld((s) => s.reducedMotion)
  useEffect(() => {
    let raf = 0
    let lastY = window.scrollY
    if (!rm) {
      lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.85, touchMultiplier: 1.1 })
    }
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const y = window.scrollY
      const v = lenis ? lenis.velocity : y - lastY
      lastY = y
      live.scrollVel += (v - live.scrollVel) * 0.2
      // journey progress is measured per chapter against the real section positions, so it stays
      // locked to the copy even when 100vh ≠ innerHeight (mobile URL bars, split views)
      const el = document.querySelector<HTMLElement>('[data-journey]')
      if (el && useWorld.getState().mode === 'home') {
        const secs = el.querySelectorAll<HTMLElement>(':scope > section[data-u]')
        let u = 0
        let total = 1
        for (const sec of secs) {
          const top = sec.getBoundingClientRect().top + y
          const su = Number(sec.dataset.u)
          const sh = Number(sec.dataset.h)
          total = Math.max(total, su)
          // within a chapter, progress runs over its full height; the next chapter starts at its own top
          const span = Math.max(1, sec.offsetHeight)
          if (y >= top - 1) u = su + Math.min(1, (y - top) / span) * sh
        }
        live.journey = Math.min(1, Math.max(0, u / total))
      }
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lenis?.destroy()
      lenis = null
    }
  }, [rm])
  return null
}
