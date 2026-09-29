import Link from 'next/link'
import { CATEGORIES } from '@/data/categories'
import { EVENTS, type EventKind } from '@/data/provisional/events'

/** Crawlable, screen-reader-first index of every event (the 3D sky is never the only way in). */
export function EventsIndex({ kind }: { kind?: EventKind }) {
  return (
    <section className="sr-only" aria-label="Event index">
      <h2>All {kind ? `${kind}s` : 'events'}</h2>
      {CATEGORIES.map((c) => {
        const list = EVENTS.filter((e) => e.category === c.id && (!kind || e.kind === kind))
        if (!list.length) return null
        return (
          <div key={c.id}>
            <h3>
              {c.name} ({c.cosmic})
            </h3>
            <ul>
              {list.map((e) => (
                <li key={e.slug}>
                  <Link href={`/events/${e.slug}`}>{e.title}</Link>: {e.format} (provisional)
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
