import type { Metadata } from 'next'
import { EventsUI } from '@/components/events/EventsUI'
import { EventsIndex } from '@/components/events/EventsIndex'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'Competitions: Constellations',
  description: `Every competition at ${FESTIVAL.name}, mapped as constellations: bands, dance crews, street plays, fashion, open mics, gaming and more.`,
  alternates: { canonical: '/competitions' },
}

export default function CompetitionsPage() {
  return (
    <div className="page page--pass page--app">
      <EventsUI competitionsOnly />
      <EventsIndex kind="competition" />
    </div>
  )
}
