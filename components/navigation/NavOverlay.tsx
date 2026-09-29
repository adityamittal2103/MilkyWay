'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { NAV, NAV_SECONDARY } from '@/data/nav'
import { useWorld } from '@/lib/store'
import { audio } from '@/lib/audio'
import { TransitionLink } from './TransitionLink'

/**
 * Constellation navigation. Left: the real, accessible list of destinations (big type).
 * Right: the same destinations plotted as a star chart; hovering an item draws your
 * trajectory from where you are to where you're going.
 */
export function NavOverlay() {
  const open = useWorld((s) => s.navOpen)
  const pathname = usePathname()
  const [hot, setHot] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const current = NAV.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href))) ?? NAV[0]

  useEffect(() => {
    if (!open) return
    const el = ref.current
    const prev = document.activeElement as HTMLElement | null
    const first = el?.querySelector<HTMLElement>('a')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useWorld.getState().set({ navOpen: false })
      if (e.key === 'Tab' && el) {
        const f = Array.from(el.querySelectorAll<HTMLElement>('a, button'))
        const i = f.indexOf(document.activeElement as HTMLElement)
        if (e.shiftKey && i <= 0) {
          e.preventDefault()
          f[f.length - 1].focus()
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault()
          f[0].focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open])

  // chart coordinates
  const W = 600
  const H = 600
  const pt = (s: [number, number]) => [Math.round((W / 2 + s[0] * W * 0.42) * 100) / 100, Math.round((H / 2 - s[1] * H * 0.42) * 100) / 100] as const
  const from = pt(current.star)
  const target = NAV.find((n) => n.href === hot)
  const to = target ? pt(target.star) : null
  const mid = to ? [(from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.25, (from[1] + to[1]) / 2 - (to[0] - from[0]) * 0.25] : null

  return (
    <div
      id="constellation-nav"
      ref={ref}
      className={`nav${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      aria-hidden={!open}
      data-ui
      inert={!open}
    >
      <nav className="nav__list" aria-label="Primary">
        <ul>
          {NAV.map((n, i) => (
            <li key={n.href} className="nav__item" style={{ ['--i' as string]: i }}>
              <TransitionLink
                href={n.href}
                label={n.label}
                aria-current={n.href === current.href ? 'page' : undefined}
                onMouseEnter={() => {
                  setHot(n.href)
                  audio.ping(1 + i * 0.06)
                }}
                onFocus={() => setHot(n.href)}
                onMouseLeave={() => setHot(null)}
                cursor="enter"
              >
                <span className="nav__code mono">{n.code}</span>
                <span>
                  <span className="nav__label">{n.label}</span>
                  <span className="nav__plain mono">{n.plain}</span>
                </span>
              </TransitionLink>
            </li>
          ))}
        </ul>
        <ul className="nav__secondary mono">
          {NAV_SECONDARY.map((n) => (
            <li key={n.href}>
              <TransitionLink href={n.href} label={n.label} cursor="target">
                {n.label}
              </TransitionLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="nav__map" aria-hidden="true">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <circle cx={W / 2} cy={H / 2} r={W * 0.46} fill="none" stroke="var(--rule)" />
          <circle cx={W / 2} cy={H / 2} r={W * 0.3} fill="none" stroke="var(--rule)" strokeDasharray="1 5" />
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--rule)" />
          <line x1={W / 2} y1={0} x2={W / 2} y2={H} stroke="var(--rule)" />
          {NAV.slice(0, -1).map((n, i) => {
            const a = pt(n.star)
            const b = pt(NAV[i + 1].star)
            return <line key={n.href} className="nm-line" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          })}
          {to && mid && <path key={hot} className="nm-traj is-on" d={`M${from[0]} ${from[1]} Q${mid[0]} ${mid[1]} ${to[0]} ${to[1]}`} />}
          {NAV.map((n) => {
            const p = pt(n.star)
            const isHot = n.href === hot
            return (
              <g key={n.href}>
                <circle className={`nm-star${isHot ? ' is-hot' : ''}`} cx={p[0]} cy={p[1]} r={isHot ? 6 : 3.2} />
                <text x={p[0] + 12} y={p[1] + 4}>
                  {n.code} {n.plain}
                </text>
              </g>
            )
          })}
          <circle className="nm-here" cx={from[0]} cy={from[1]} r={13} />
          <text x={from[0] + 12} y={from[1] - 14} style={{ fill: 'var(--flare)' }}>
            You are here
          </text>
        </svg>
      </div>
    </div>
  )
}
