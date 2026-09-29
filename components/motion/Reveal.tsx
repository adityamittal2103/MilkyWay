'use client'
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Masked line reveals. Lines are authored (not auto-split) so breaks are typographic decisions.
 * Text is in the DOM from the start (SEO, screen readers); only its transform animates.
 */
function useInView<T extends Element>(once = true, margin = '0px 0px -12% 0px') {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true)
          if (once) io.disconnect()
        } else if (!once) setSeen(false)
      },
      { rootMargin: margin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, margin])
  return [ref, seen] as const
}

export function RevealLines({
  lines,
  as = 'p',
  className = '',
  delay = 0,
  force,
}: {
  lines: ReactNode[]
  as?: 'p' | 'h1' | 'h2' | 'h3' | 'div' | 'span'
  className?: string
  delay?: number
  force?: boolean
}) {
  const [ref, seen] = useInView<HTMLElement>()
  const on = force ?? seen
  return createElement(
    as,
    { ref, className: `reveal ${on ? 'is-in' : ''} ${className}`, style: { ['--d' as string]: `${delay}ms` } },
    lines.map((l, i) => (
      <span className="reveal__line" key={i}>
        <span className="reveal__inner" style={{ ['--i' as string]: i }}>
          {l}
        </span>
      </span>
    )),
  )
}

export function Fade({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className={`fade ${seen ? 'is-in' : ''} ${className}`} style={{ ['--d' as string]: `${delay}ms` }}>
      {children}
    </div>
  )
}
