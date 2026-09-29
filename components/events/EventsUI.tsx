'use client'
import { useEffect, useMemo } from 'react'
import { CATEGORIES, categoryById } from '@/data/categories'
import { EVENTS, PROVISIONAL_DAYS } from '@/data/provisional/events'
import { applyFilter } from '@/lib/filter'
import { zoneById } from '@/data/zones'
import { useWorld } from '@/lib/store'
import { audio } from '@/lib/audio'
import { TransitionLink } from '@/components/navigation/TransitionLink'

// quick shortcuts into the global filter (the full dial lives in the top bar)
const QUICK: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'competitions', label: 'Competitions' },
  { id: 'performances', label: 'Performances' },
  { id: 'workshop', label: 'Workshops' },
]

/**
 * Event discovery without a card grid. Categories are constellations in the sky above the
 * hall; this panel is the same universe as a list. Selecting a constellation (here or in the
 * sky) flies the camera to it and blooms its events.
 */
export function EventsUI({ competitionsOnly = false }: { competitionsOnly?: boolean }) {
  const selected = useWorld((s) => s.selectedCategory)
  const hovered = useWorld((s) => s.hoveredCategory)
  const filter = useWorld((s) => s.filter)
  const f = applyFilter(filter)
  const cat = categoryById(selected)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useWorld.getState().set({ selectedCategory: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // competitions page: competitions only; events page: whatever the global filter says
  const pool = useMemo(
    () => EVENTS.filter((e) => (competitionsOnly ? e.kind === 'competition' : f.def.id === 'all' || f.events.has(e.slug))),
    [competitionsOnly, f],
  )
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, pool.filter((e) => e.category === c.id).length])), [pool])
  const list = cat ? pool.filter((e) => e.category === cat.id) : []

  const pick = (id: string | null) => {
    useWorld.getState().set({ selectedCategory: id })
    audio.ping(1.1)
  }

  return (
    <>
      <aside className="panel panel--left" data-ui aria-label={competitionsOnly ? 'Competition categories' : 'Event categories'}>
        <div className="panel__head">
          <p className="ch__index mono">
            <span>{competitionsOnly ? '04' : '01'}</span> {competitionsOnly ? 'Competitions' : 'Events'}
          </p>
          <h1 className="title">{competitionsOnly ? 'Constellations' : 'Enter the orbit'}</h1>
          <p className="mono dust">
            {pool.length} {competitionsOnly ? 'competitions' : 'events'} · <span className="provisional">Provisional programme</span>
          </p>
        </div>
        {!competitionsOnly && (
          <div className="seg mono" role="radiogroup" aria-label="Filter">
            {QUICK.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={filter === k.id} className="seg__btn" onClick={() => useWorld.getState().set({ filter: k.id })} data-cursor="target">
                {k.label}
              </button>
            ))}
            <button type="button" className="seg__btn seg__btn--more" onClick={() => useWorld.getState().set({ filterOpen: true })} data-cursor="target">
              {QUICK.some((q) => q.id === filter) ? 'More ◎' : `${f.def.label} ◎`}
            </button>
          </div>
        )}
        <ul className="cat-list">
          {CATEGORIES.map((c) => {
            const n = counts[c.id]
            const on = c.id === selected
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={`cat-btn${on ? ' is-on' : ''}${c.id === hovered ? ' is-hot' : ''}`}
                  style={{ ['--accent' as string]: c.accent }}
                  aria-pressed={on}
                  disabled={n === 0}
                  onClick={() => pick(on ? null : c.id)}
                  onMouseEnter={() => useWorld.getState().set({ hoveredCategory: c.id })}
                  onMouseLeave={() => useWorld.getState().set({ hoveredCategory: null })}
                  data-cursor="event"
                >
                  <span className="cat-btn__cosmic">{c.cosmic}</span>
                  <span className="cat-btn__plain mono">
                    {c.name} · {n}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className={`panel panel--right cat-detail${cat ? ' is-open' : ''}`} data-ui aria-live="polite" aria-label="Events in category">
        {cat ? (
          <div key={cat.id + filter} className="cat-detail__inner" style={{ ['--accent' as string]: cat.accent }}>
            <p className="mono" style={{ color: cat.accent }}>
              ✦ {cat.name}
            </p>
            <h2 className="title">{cat.cosmic}</h2>
            <p className="lead">{cat.line}</p>
            <ol className="ev-list">
              {list.map((e, i) => {
                const z = zoneById(e.zone)
                return (
                  <li key={e.slug} style={{ ['--i' as string]: i }}>
                    <TransitionLink href={`/events/${e.slug}`} label={e.title} cursor="event" className="ev-row">
                      <span className="ev-row__title">{e.title}</span>
                      <span className="ev-row__meta mono">
                        {e.kind} · {z?.name} · {PROVISIONAL_DAYS[e.day]?.label} {e.start}
                      </span>
                      <span className="ev-row__arrow" aria-hidden="true">
                        →
                      </span>
                    </TransitionLink>
                  </li>
                )
              })}
              {list.length === 0 && <li className="mono dust">Nothing of this type in {cat.cosmic} yet.</li>}
            </ol>
            <button type="button" className="go mono" onClick={() => pick(null)} data-cursor="target">
              ← All constellations
            </button>
          </div>
        ) : (
          <div className="sector-detail__hint mono dust">
            <p>Hover the sky to trace a constellation. Click to fly there.</p>
          </div>
        )}
      </section>
    </>
  )
}
