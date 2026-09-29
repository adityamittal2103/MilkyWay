import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { EVENTS, PROVISIONAL_DAYS, eventBySlug } from '@/data/provisional/events'
import { categoryById } from '@/data/categories'
import { zoneById } from '@/data/zones'
import { FESTIVAL } from '@/data/festival'
import { WorldFocus } from '@/components/world/WorldFocus'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { RevealLines } from '@/components/motion/Reveal'
import { SectorGlyph } from '@/components/ui/SectorGlyph'

export function generateStaticParams() {
  return EVENTS.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const e = eventBySlug(slug)
  if (!e) return {}
  const c = categoryById(e.category)
  return {
    title: `${e.title} · ${c?.name}`,
    description: `${e.title} at ${FESTIVAL.name}, ${FESTIVAL.venue.name}. ${e.format}`,
    alternates: { canonical: `/events/${e.slug}` },
  }
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const e = eventBySlug(slug)
  if (!e) notFound()
  const c = categoryById(e.category)!
  const z = zoneById(e.zone)!
  const day = PROVISIONAL_DAYS[e.day]
  const siblings = EVENTS.filter((x) => x.category === e.category && x.slug !== e.slug)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: e.title,
    description: e.format,
    location: { '@type': 'Place', name: `${z.name}, ${FESTIVAL.venue.name}`, address: `${FESTIVAL.venue.locality}, ${FESTIVAL.venue.city}` },
    organizer: { '@type': 'Organization', name: FESTIVAL.organiser },
    superEvent: { '@type': 'Festival', name: FESTIVAL.name },
    eventStatus: 'https://schema.org/EventScheduled',
  }

  return (
    <div className="page page--pass page--event">
      <WorldFocus category={e.category} event={e.slug} />
      <article className="event" data-ui style={{ ['--accent' as string]: c.accent }}>
        <nav className="event__crumbs mono" aria-label="Breadcrumb">
          <TransitionLink href="/events" label="Enter the Orbit" cursor="target">
            Events
          </TransitionLink>
          <span aria-hidden="true">/</span>
          <span style={{ color: c.accent }}>
            ✦ {c.cosmic} · {c.name}
          </span>
        </nav>
        <RevealLines as="h1" className="title title--hero event__title" lines={[e.title]} force />
        <p className="event__kind mono">
          {e.kind} {e.provisional && <span className="provisional">Provisional listing</span>}
        </p>
        <p className="lead event__format">{e.format}</p>

        <dl className="event__facts">
          <div>
            <dt className="mono dust">When</dt>
            <dd>
              <span className="event__big">
                {day.label} · {e.start}–{e.end}
              </span>
              <span className="mono dust">{day.date ?? 'Dates on transmission'}</span>
            </dd>
          </div>
          <div>
            <dt className="mono dust">Where</dt>
            <dd>
              <span className="event__big event__where">
                <SectorGlyph glyph={z.glyph} size={28} color={z.accent} />
                {z.name}
              </span>
              <TransitionLink href={`/venue?zone=${z.id}`} label="Land at Yashobhoomi" className="go go--ion" cursor="enter">
                {z.code} · Locate on the map <span className="go__arrow">→</span>
              </TransitionLink>
            </dd>
          </div>
          <div>
            <dt className="mono dust">Performers</dt>
            <dd>{e.artists.length ? e.artists.join(', ') : <span className="mono dust">On transmission</span>}</dd>
          </div>
          <div>
            <dt className="mono dust">Entry</dt>
            <dd>
              {e.registrationUrl ? (
                <a href={e.registrationUrl} className="go go--ion">
                  Register for this event <span className="go__arrow">↗</span>
                </a>
              ) : (
                <span className="mono dust">Event registration opens with the programme. Board the Milky Way to be notified.</span>
              )}
            </dd>
          </div>
        </dl>

        <TransitionLink href="/register" label="Board the Milky Way" className="board board--lg" cursor="pulse" data-cursor-label="BOARD">
          <span className="board__flame" aria-hidden="true" />
          Board the Milky Way
        </TransitionLink>

        {siblings.length > 0 && (
          <aside className="event__more">
            <p className="mono dust">Also in {c.cosmic}</p>
            <ul>
              {siblings.map((s) => (
                <li key={s.slug}>
                  <TransitionLink href={`/events/${s.slug}`} label={s.title} className="ev-row" cursor="event">
                    <span className="ev-row__title">{s.title}</span>
                    <span className="ev-row__meta mono">
                      {s.kind} · {zoneById(s.zone)?.name}
                    </span>
                    <span className="ev-row__arrow" aria-hidden="true">
                      →
                    </span>
                  </TransitionLink>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </div>
  )
}
