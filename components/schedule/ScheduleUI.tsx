'use client'
import { useEffect, useMemo, useState } from 'react'
import { EVENTS, PROVISIONAL_DAYS, toMinutes } from '@/data/provisional/events'
import { categoryById } from '@/data/categories'
import { FILTERS, applyFilter } from '@/lib/filter'
import { ARTISTS } from '@/data/artists'
import { ZONES, zoneById } from '@/data/zones'
import { useWorld } from '@/lib/store'
import { TransitionLink } from '@/components/navigation/TransitionLink'

/**
 * Mission Timeline controls. Orbit view = the 3D rings (days) with events riding them.
 * List view = a conventional, accessible schedule table. Same filters drive both.
 */
export function ScheduleUI() {
  const day = useWorld((s) => s.day)
  const filter = useWorld((s) => s.filter)
  const selectedEvent = useWorld((s) => s.selectedEvent)
  const f = applyFilter(filter)
  const zone = useWorld((s) => s.filterZone)
  const hovered = useWorld((s) => s.hoveredEvent)
  const webgl = useWorld((s) => s.webgl)
  const [view, setView] = useState<'orbit' | 'list'>('orbit')

  useEffect(() => {
    if (!webgl) setView('list')
  }, [webgl])
  useEffect(() => {
    document.documentElement.dataset.scheduleView = view
    return () => {
      delete document.documentElement.dataset.scheduleView
    }
  }, [view])
  useEffect(
    () => () => useWorld.getState().set({ day: null, filterZone: null, hoveredEvent: null, selectedEvent: null }),
    [],
  )

  const set = useWorld.getState().set
  const list = useMemo(
    () =>
      EVENTS.filter((e) => (day == null || e.day === day) && (f.def.id === 'all' || f.events.has(e.slug)) && (!zone || e.zone === zone)).sort(
        (a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start),
      ),
    [day, f, zone],
  )
  const hov = hovered ? EVENTS.find((e) => e.slug === hovered) : null

  return (
    <>
      <div className={`schedule-bar${view === 'list' ? ' is-list' : ''}`} data-ui>
        <div className="schedule-bar__title">
          <p className="ch__index mono">
            <span>03</span> Schedule
          </p>
          <h1 className="title">Mission timeline</h1>
          <p className="provisional">Provisional orbits · final timings on transmission</p>
        </div>
        <div className="schedule-bar__controls">
          <div className="seg mono" role="radiogroup" aria-label="Day">
            <button type="button" role="radio" aria-checked={day == null} className="seg__btn" onClick={() => set({ day: null })} data-cursor="target">
              All days
            </button>
            {PROVISIONAL_DAYS.map((d) => (
              <button key={d.index} type="button" role="radio" aria-checked={day === d.index} className="seg__btn" onClick={() => set({ day: d.index })} data-cursor="target">
                {d.label}
              </button>
            ))}
          </div>
          <label className="select mono">
            <span className="sr-only">Filter</span>
            <select value={filter} onChange={(e) => set({ filter: e.target.value })}>
              {FILTERS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id === 'all' ? 'Everything' : x.label}
                </option>
              ))}
            </select>
          </label>
          <label className="select mono">
            <span className="sr-only">Artist</span>
            <select value="" disabled={ARTISTS.length === 0} onChange={() => {}} title={ARTISTS.length ? 'Filter by artist' : 'Line-up on transmission'}>
              <option value="">{ARTISTS.length ? 'All artists' : 'Artists · on transmission'}</option>
              {ARTISTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="select mono">
            <span className="sr-only">Sector</span>
            <select value={zone ?? ''} onChange={(e) => set({ filterZone: e.target.value || null })}>
              <option value="">All sectors</option>
              {ZONES.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} {z.name}
                </option>
              ))}
            </select>
          </label>
          <div className="seg mono" role="radiogroup" aria-label="View">
            <button type="button" role="radio" aria-checked={view === 'orbit'} className="seg__btn" onClick={() => setView('orbit')} disabled={!webgl} data-cursor="target">
              Orbit
            </button>
            <button type="button" role="radio" aria-checked={view === 'list'} className="seg__btn" onClick={() => setView('list')} data-cursor="target">
              List
            </button>
          </div>
        </div>
      </div>

      {view === 'orbit' && selectedEvent && (() => {
        const e = EVENTS.find((x) => x.slug === selectedEvent)!
        return (
          <div className="holo sched-pick" data-ui style={{ ['--accent' as string]: categoryById(e.category)?.accent }} aria-live="polite">
            <p className="mono" style={{ color: categoryById(e.category)?.accent }}>
              {PROVISIONAL_DAYS[e.day].label} · {e.start}–{e.end}
            </p>
            <p className="sched-pick__title">{e.title}</p>
            <p className="mono dust">
              {zoneById(e.zone)?.code} {zoneById(e.zone)?.name} · highlighted in the hall below
            </p>
            <div className="sched-pick__actions">
              <TransitionLink href={`/events/${e.slug}`} label={e.title} className="go go--ion" cursor="enter">
                Open event <span className="go__arrow">→</span>
              </TransitionLink>
              <TransitionLink href={`/venue?zone=${e.zone}`} label="Land at Yashobhoomi" className="go" cursor="target">
                Locate in venue <span className="go__arrow">→</span>
              </TransitionLink>
              <button type="button" className="go" onClick={() => set({ selectedEvent: null, selectedZone: null })} data-cursor="target">
                Clear
              </button>
            </div>
          </div>
        )
      })()}

      {view === 'orbit' && (
        <div className="orbit-legend mono" data-ui aria-hidden={!!hov}>
          <p className="dust">
            Inner ring {PROVISIONAL_DAYS[0].label} · outer {PROVISIONAL_DAYS[PROVISIONAL_DAYS.length - 1].label} · 10:00 at the top, clockwise to midnight
          </p>
          <p>{list.length} events in view · hover a node, click to open</p>
        </div>
      )}

      <section className={`schedule-list${view === 'list' ? ' is-open' : ''}`} data-ui aria-label="Schedule list" hidden={view !== 'list'}>
        {PROVISIONAL_DAYS.filter((d) => day == null || d.index === day).map((d) => {
          const rows = list.filter((e) => e.day === d.index)
          if (!rows.length) return null
          return (
            <div key={d.index} className="schedule-day">
              <h2 className="schedule-day__label">
                {d.label} <span className="mono dust">{d.date ?? 'Date on transmission'}</span>
              </h2>
              <table className="schedule-table">
                <thead className="mono dust">
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Event</th>
                    <th scope="col">Category</th>
                    <th scope="col">Sector</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.slug} style={{ ['--accent' as string]: categoryById(e.category)?.accent }}>
                      <td className="mono">
                        {e.start}–{e.end}
                      </td>
                      <td>
                        <TransitionLink href={`/events/${e.slug}`} label={e.title} cursor="event" className="schedule-table__ev">
                          {e.title}
                        </TransitionLink>
                        <span className="mono dust"> {e.kind}</span>
                      </td>
                      <td className="mono">{categoryById(e.category)?.name}</td>
                      <td className="mono">
                        <TransitionLink href={`/venue?zone=${e.zone}`} label="Land at Yashobhoomi" cursor="target">
                          {zoneById(e.zone)?.code} {zoneById(e.zone)?.name}
                        </TransitionLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        {list.length === 0 && <p className="mono dust">No events match these filters.</p>}
      </section>
    </>
  )
}
