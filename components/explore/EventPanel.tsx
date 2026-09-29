'use client'
import { eventBySlug, PROVISIONAL_DAYS } from '@/data/provisional/events'
import { categoryById } from '@/data/categories'
import { zoneById } from '@/data/zones'
import { FESTIVAL } from '@/data/festival'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { SectorGlyph } from '@/components/ui/SectorGlyph'

/**
 * The practical layer. However cinematic the arrival, an event resolves to plain facts:
 * when, where, what it is, whether it's confirmed, and how to register.
 */
export function EventPanel({ slug, onClose }: { slug: string; onClose?: () => void }) {
  const e = eventBySlug(slug)
  if (!e) return null
  const c = categoryById(e.category)!
  const z = zoneById(e.zone)!
  const day = PROVISIONAL_DAYS[e.day]
  return (
    <article className="holo ev-panel" style={{ ['--accent' as string]: c.accent }} aria-label={`Event: ${e.title}`}>
      <header className="holo__head">
        <span className="holo__sys mono">EVT · {c.cosmic.toUpperCase()}</span>
        {onClose && (
          <button type="button" className="holo__close mono" onClick={onClose} aria-label="Close event" data-cursor="target">
            ×
          </button>
        )}
      </header>
      <p className="ev-panel__kind mono" style={{ color: c.accent }}>
        {e.kind} · {c.name}
      </p>
      <h2 className="ev-panel__title">{e.title}</h2>
      <p className="ev-panel__format">{e.format}</p>
      <dl className="ev-panel__facts">
        <div>
          <dt className="mono dust">When</dt>
          <dd>
            {day.label} · {e.start}–{e.end}
            <span className="mono dust"> {day.date ?? '· date on transmission'}</span>
          </dd>
        </div>
        <div>
          <dt className="mono dust">Where</dt>
          <dd className="ev-panel__where">
            <SectorGlyph glyph={z.glyph} size={18} color={z.accent} /> {z.code} {z.name}, {FESTIVAL.venue.name}
          </dd>
        </div>
        <div>
          <dt className="mono dust">Entry</dt>
          <dd>{e.registrationUrl ? 'Registration open' : 'Opens with the programme'}</dd>
        </div>
      </dl>
      {e.provisional && <p className="provisional">Provisional listing</p>}
      <div className="ev-panel__actions">
        <TransitionLink href={`/events/${e.slug}`} label={e.title} className="go go--ion" cursor="enter">
          Full details <span className="go__arrow">→</span>
        </TransitionLink>
        <TransitionLink href="/register" label="Board the Milky Way" className="board" cursor="pulse" data-cursor-label="BOARD">
          <span className="board__flame" aria-hidden="true" />
          Register
        </TransitionLink>
      </div>
    </article>
  )
}
