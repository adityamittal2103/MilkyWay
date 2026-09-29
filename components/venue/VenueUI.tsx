'use client'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { ZONES, zoneById } from '@/data/zones'
import { eventsInZone } from '@/data/provisional/events'
import { categoryById } from '@/data/categories'
import { useWorld } from '@/lib/store'
import { audio } from '@/lib/audio'
import { SectorGlyph } from '@/components/ui/SectorGlyph'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { VenuePlan } from './VenuePlan'
import { Radar } from '@/components/explore/Radar'
import { EventPanel } from '@/components/explore/EventPanel'
import { applyFilter } from '@/lib/filter'

/**
 * The venue map's DOM layer. The 3D map is the spectacle; this is the control surface:
 * every sector is a real button, and hover/selection is two-way synced with the world.
 */
export function VenueUI() {
  const selected = useWorld((s) => s.selectedZone)
  const hovered = useWorld((s) => s.hoveredZone)
  const webgl = useWorld((s) => s.webgl)
  const selectedEvent = useWorld((s) => s.selectedEvent)
  const filter = useWorld((s) => s.filter)
  const f = applyFilter(filter)
  const filtered = f.def.id !== 'all'
  const params = useSearchParams()
  const zone = zoneById(selected)

  useEffect(() => {
    const z = params.get('zone')
    if (z && zoneById(z)) {
      const t = setTimeout(() => useWorld.getState().set({ selectedZone: z }), 0)
      return () => clearTimeout(t)
    }
  }, [params])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useWorld.getState()
      if (e.key === 'Escape' && !st.filterOpen && !st.selectedEvent && st.selectedZone) st.set({ selectedZone: null })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (id: string | null) => {
    useWorld.getState().set({ selectedZone: id, selectedEvent: null })
    if (id) useWorld.getState().discover(`zone:${id}`)
    audio.ping(1.2)
  }
  const pickEvent = (slug: string) => {
    useWorld.getState().set({ selectedEvent: slug })
    useWorld.getState().discover(`event:${slug}`)
    audio.engage()
  }
  const idx = zone ? ZONES.indexOf(zone) : -1
  const events = zone ? eventsInZone(zone.id) : []

  return (
    <>
      <aside className="panel panel--left" data-ui aria-label="Venue sectors">
        <div className="panel__head">
          <p className="ch__index mono">
            <span>02</span> Venue map
          </p>
          <h1 className="title">Land at Yashobhoomi</h1>
          <p className="mono dust">Sector uses provisional · plan from the festival model</p>
        </div>
        <ul className="sector-list">
          {ZONES.map((z) => {
            const on = z.id === selected
            return (
              <li key={z.id}>
                <button
                  type="button"
                  className={`sector-btn${on ? ' is-on' : ''}${z.id === hovered ? ' is-hot' : ''}${filtered && !f.zoneCount.get(z.id) ? ' is-dim' : ''}`}
                  style={{ ['--accent' as string]: z.accent }}
                  aria-pressed={on}
                  onClick={() => select(on ? null : z.id)}
                  onMouseEnter={() => useWorld.getState().set({ hoveredZone: z.id })}
                  onMouseLeave={() => useWorld.getState().set({ hoveredZone: null })}
                  onFocus={() => useWorld.getState().set({ hoveredZone: z.id })}
                  onBlur={() => useWorld.getState().set({ hoveredZone: null })}
                  data-cursor="target"
                >
                  <SectorGlyph glyph={z.glyph} size={28} />
                  <span className="sector-btn__code mono">{z.code}</span>
                  <span className="sector-btn__name">{z.name}</span>
                  <span className="sector-btn__sub mono">
                    {z.subtitle}
                    {filtered && f.zoneCount.get(z.id) ? ` · ${f.zoneCount.get(z.id)} ${f.def.label.toLowerCase()}` : ''}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </aside>

      <section className={`panel panel--right sector-detail${zone || selectedEvent ? ' is-open' : ''}`} data-ui aria-live="polite" aria-label="Sector details">
        {selectedEvent ? (
          <EventPanel slug={selectedEvent} onClose={() => useWorld.getState().set({ selectedEvent: null })} />
        ) : zone ? (
          <div key={zone.id} className="sector-detail__inner" style={{ ['--accent' as string]: zone.accent }}>
            <div className="sector-detail__top">
              <SectorGlyph glyph={zone.glyph} size={56} color={zone.accent} />
              <p className="mono">
                <span style={{ color: zone.accent }}>{zone.code}</span> · {zone.subtitle}
              </p>
            </div>
            <h2 className="title sector-detail__name">{zone.name}</h2>
            <p className="lead">{zone.description}</p>
            <dl className="sector-detail__facts mono">
              <div>
                <dt className="dust">Use</dt>
                <dd>
                  {zone.use} <span className="provisional">Provisional</span>
                </dd>
              </div>
              <div>
                <dt className="dust">In the plan</dt>
                <dd>{zone.evidence}</dd>
              </div>
            </dl>
            {events.length > 0 && (
              <div className="sector-detail__events">
                <p className="mono dust">Happening here</p>
                <ul>
                  {events.map((e) => (
                    <li key={e.slug}>
                      <button type="button" onClick={() => pickEvent(e.slug)} data-cursor="event" className={`ev-row${e.slug === selectedEvent ? ' is-on' : ''}${filtered && !f.events.has(e.slug) ? ' is-dim' : ''}`}>
                        <span className="ev-row__title">{e.title}</span>
                        <span className="ev-row__meta mono">
                          {categoryById(e.category)?.cosmic} · {e.kind}
                        </span>
                        <span className="ev-row__arrow" aria-hidden="true">
                          →
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="sector-detail__nav mono">
              <button type="button" onClick={() => select(ZONES[(idx - 1 + ZONES.length) % ZONES.length].id)} data-cursor="target">
                ← Prev
              </button>
              <button type="button" onClick={() => select(null)} data-cursor="target">
                Full map
              </button>
              <button type="button" onClick={() => select(ZONES[(idx + 1) % ZONES.length].id)} data-cursor="target">
                Next →
              </button>
            </div>
          </div>
        ) : (
          <div className="sector-detail__hint mono dust">
            <p>{webgl ? 'Hover the hall to scan a sector. Click to land.' : 'Select a sector on the plan.'}</p>
          </div>
        )}
      </section>

      {webgl ? (
        <div className={`venue-radar${zone || selectedEvent ? ' is-hidden' : ''}`}>
          <Radar compact />
        </div>
      ) : (
        <div className="minimap minimap--full" data-ui>
          <VenuePlan interactive />
          <p className="mono dust minimap__caption">
            Hall plan · N ↑ · {ZONES.length} sectors
          </p>
        </div>
      )}
      {webgl && !zone && !selectedEvent && (
        <p className="venue-hint mono dust" aria-hidden="true">
          Drag to orbit · scroll to zoom · WASD to move · pins are events
        </p>
      )}
    </>
  )
}
