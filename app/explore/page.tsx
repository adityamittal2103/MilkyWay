import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ExploreHUD } from '@/components/explore/ExploreHUD'
import { PLANETS } from '@/data/planets'
import { ZONES } from '@/data/zones'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'Explore the Milky Way',
  description: `Fly the ${FESTIVAL.name} universe: the galaxy, the five worlds of the Yashobhoomi system, and every sector of the hall. Filter by what you're into and travel to it.`,
  alternates: { canonical: '/explore' },
}

export default function ExplorePage() {
  return (
    <div className="page page--pass page--app page--explore">
      <h1 className="sr-only">Explore the Milky Way</h1>
      <Suspense>
        <ExploreHUD />
      </Suspense>
      {/* the same universe, as text */}
      <section className="sr-only" aria-label="Destinations">
        <h2>Worlds of the Yashobhoomi system</h2>
        <ul>
          {PLANETS.map((p) => (
            <li key={p.id}>
              {p.name}: {p.group}. {p.line}
            </li>
          ))}
        </ul>
        <h2>Sectors of the hall</h2>
        <ul>
          {ZONES.map((z) => (
            <li key={z.id}>
              {z.code} {z.name}: {z.description}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
