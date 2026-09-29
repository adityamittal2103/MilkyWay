import type { Metadata } from 'next'
import { Suspense } from 'react'
import { VenueUI } from '@/components/venue/VenueUI'
import { ZONES } from '@/data/zones'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'Venue map: Land at Yashobhoomi',
  description: `Interactive 3D map of ${FESTIVAL.name} at ${FESTIVAL.venue.name}, ${FESTIVAL.venue.city}, built from the festival floor plan. ${ZONES.length} sectors from the Docking Bay to the Supergiant main stage.`,
  alternates: { canonical: '/venue' },
}

export default function VenuePage() {
  return (
    <div className="page page--pass page--app">
      <Suspense>
        <VenueUI />
      </Suspense>
      {/* crawlable summary of every sector */}
      <section className="sr-only" aria-label="All sectors">
        <h2>Sectors at {FESTIVAL.venue.name}</h2>
        <ul>
          {ZONES.map((z) => (
            <li key={z.id}>
              {z.code} {z.name}: {z.subtitle}. {z.description} Provisional use: {z.use}.
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
