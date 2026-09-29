'use client'
import { useEffect, useRef } from 'react'

/** An oscilloscope that never quite locks on: the line-up is still decrypting. */
export function Signal() {
  const ref = useRef<SVGPathElement>(null)
  useEffect(() => {
    let raf = 0
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw = (t: number) => {
      const pts: string[] = []
      for (let i = 0; i <= 120; i++) {
        const x = i * 5
        const env = Math.sin((i / 120) * Math.PI)
        const y = 60 + env * (Math.sin(i * 0.35 + t * 0.004) * 22 + Math.sin(i * 1.7 - t * 0.011) * 9 * Math.abs(Math.sin(t * 0.0013)) + (Math.random() - 0.5) * 6 * env)
        pts.push(`${i ? 'L' : 'M'}${x} ${y.toFixed(1)}`)
      }
      ref.current?.setAttribute('d', pts.join(' '))
      if (!rm) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <svg className="signal" viewBox="0 0 600 120" aria-hidden="true">
      <line x1="0" y1="60" x2="600" y2="60" stroke="var(--rule)" />
      <path ref={ref} fill="none" stroke="var(--ion)" strokeWidth="1.4" />
    </svg>
  )
}
