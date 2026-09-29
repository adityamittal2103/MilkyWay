'use client'
import { useEffect, useRef, useState } from 'react'
import { FILTERS, applyFilter } from '@/lib/filter'
import { zoneById } from '@/data/zones'
import { useWorld } from '@/lib/store'
import { audio } from '@/lib/audio'
import { jump } from '@/lib/jump'

/**
 * The orbital selector. Centre = ALL. Inner orbit = what kind of thing. Outer orbit = discipline.
 * Choosing a filter reshapes the WORLD (sector heat, constellations, planets, event pins,
 * particles, light) and suggests a destination. The dial stays open over a light veil so you can
 * watch the universe reorganise; it is a real radiogroup for keyboards and screen readers.
 */
/** SVG coordinates computed with trig must be rounded or SSR and client disagree in the last digit */
const r2 = (n: number) => Math.round(n * 100) / 100
const R_IN = 118
const R_OUT = 206

export function FilterDial() {
  const open = useWorld((s) => s.filterOpen)
  const active = useWorld((s) => s.filter)
  const mode = useWorld((s) => s.mode)
  const [hot, setHot] = useState<string | null>(null)
  // a choice is a physical event: the node locks, a signal pulse leaves the hub (the world answers too)
  const [lock, setLock] = useState({ id: '', n: 0, accent: '#F1EDE4' })
  const ref = useRef<HTMLDivElement>(null)
  const shown = applyFilter(hot ?? active)
  const inner = FILTERS.filter((f) => f.ring === 1)
  const outer = FILTERS.filter((f) => f.ring === 2)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useWorld.getState().set({ filterOpen: false })
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
        const btns = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])
        const i = btns.indexOf(document.activeElement as HTMLElement)
        if (i < 0) return
        e.preventDefault()
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
        btns[(i + d + btns.length) % btns.length].focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [open])

  const choose = (id: string) => {
    useWorld.getState().set({ filter: id })
    audio.confirm(id === 'all' ? 0.8 : 1.2)
    setLock((l) => ({ id, n: l.n + 1, accent: applyFilter(id).def.accent }))
  }
  const fly = () => {
    const z = shown.suggested
    if (!z) return
    const st = useWorld.getState()
    st.set({ filterOpen: false })
    if (st.mode === 'explore') st.set({ nav: { kind: 'zone', id: z }, selectedZone: z })
    else if (st.mode === 'venue') st.set({ selectedZone: z })
    else jump(`/venue?zone=${z}`, 'Land at Yashobhoomi')
  }

  const node = (id: string, label: string, accent: string, angle: number, r: number) => {
    const x = r2(Math.cos(angle) * r)
    const y = r2(Math.sin(angle) * r)
    const on = active === id
    const res = applyFilter(id)
    const lx = r2(Math.cos(angle) * (r + 26))
    const ly = r2(Math.sin(angle) * (r + 26))
    return (
      <g key={id}>
        <line x1={0} y1={0} x2={x} y2={y} className={`dial__spoke${hot === id || on ? ' is-on' : ''}`} style={{ ['--accent' as string]: accent }} />
        <foreignObject x={x - 22} y={y - 22} width={44} height={44}>
          <button
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${label}: ${res.total} ${id === 'food' ? 'sectors' : 'events'}`}
            className={`dial__node${on ? ' is-on' : ''}${lock.id === id && lock.n ? ' is-locking' : ''}`}
            style={{ ['--accent' as string]: accent }}
            onClick={() => choose(id)}
            onMouseEnter={() => setHot(id)}
            onMouseLeave={() => setHot(null)}
            onFocus={() => setHot(id)}
            onBlur={() => setHot(null)}
            data-cursor="target"
          >
            <span className="dial__dot" />
          </button>
        </foreignObject>
        <text x={lx} y={ly} className={`dial__label${on ? ' is-on' : ''}`} textAnchor={Math.abs(Math.cos(angle)) < 0.2 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end'} dominantBaseline="middle">
          {label}
        </text>
      </g>
    )
  }

  const sug = zoneById(shown.suggested)
  return (
    <div
      className={`dial-wrap${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Filter the festival"
      aria-hidden={!open}
      inert={!open}
      data-ui
      onClick={(e) => {
        if (e.target === e.currentTarget) useWorld.getState().set({ filterOpen: false })
      }}
    >
      <div className="dial" ref={ref}>
        <svg viewBox="-300 -300 600 600" className="dial__svg">
          <circle r={R_OUT} className="dial__orbit" />
          <circle r={R_IN} className="dial__orbit dial__orbit--in" />
          <circle r={R_OUT + 44} className="dial__rim" />
          {lock.n > 0 && (
            <g key={lock.n} style={{ ['--accent' as string]: lock.accent }}>
              <circle r={60} className="dial__wave" />
              <circle r={60} className="dial__wave dial__wave--late" />
            </g>
          )}
          {Array.from({ length: 72 }, (_, i) => {
            const a = (i / 72) * Math.PI * 2
            const l = i % 6 === 0 ? 10 : 4
            return <line key={i} x1={r2(Math.cos(a) * (R_OUT + 44))} y1={r2(Math.sin(a) * (R_OUT + 44))} x2={r2(Math.cos(a) * (R_OUT + 44 - l))} y2={r2(Math.sin(a) * (R_OUT + 44 - l))} className="dial__tick" />
          })}
          <g role="radiogroup" aria-label="Filters">
            {inner.map((f, i) => node(f.id, f.label, f.accent, -Math.PI / 2 + (i / inner.length) * Math.PI * 2 + Math.PI / 4, R_IN))}
            {outer.map((f, i) => node(f.id, f.label, f.accent, -Math.PI / 2 + (i / outer.length) * Math.PI * 2, R_OUT))}
          </g>
          <foreignObject x={-72} y={-72} width={144} height={144}>
            <button type="button" role="radio" aria-checked={active === 'all'} className={`dial__hub${active === 'all' ? ' is-on' : ''}`} onClick={() => choose('all')} onMouseEnter={() => setHot('all')} onMouseLeave={() => setHot(null)} data-cursor="target">
              <span className="dial__hub-label">{shown.def.label}</span>
              <span className="dial__hub-count">{shown.def.id === 'all' ? 'everything' : `${shown.total} ${shown.def.id === 'food' ? 'sectors' : 'events'}`}</span>
            </button>
          </foreignObject>
        </svg>
        <div className="dial__readout mono" aria-live="polite">
          <span className="dust">Filter</span> <b>{shown.def.label}</b>
          {sug && (
            <>
              <span className="dust"> · suggested destination</span> <b>{sug.code} {sug.name}</b>
            </>
          )}
        </div>
        <div className="dial__actions">
          {sug && (
            <button type="button" className="go go--ion" onClick={fly} data-cursor="enter" data-cursor-label="FLY">
              {mode === 'explore' || mode === 'venue' ? 'Fly there' : 'Show me on the map'} <span className="go__arrow">→</span>
            </button>
          )}
          <button type="button" className="go" onClick={() => useWorld.getState().set({ filterOpen: false })} data-cursor="target">
            Close <span className="go__arrow">×</span>
          </button>
        </div>
      </div>
    </div>
  )
}
