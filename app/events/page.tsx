import type { Metadata } from 'next'
import { EventsUI } from '@/components/events/EventsUI'
import { EventsIndex } from '@/components/events/EventsIndex'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'Events: Enter the orbit',
  description: `Explore ${FESTIVAL.name}'s events as constellations above the hall at ${FESTIVAL.venue.name}: music, dance, theatre, fashion, comedy, art, workshops, informals and experiences.`,
  alternates: { canonical: '/events' },
}

export default function EventsPage() {
  return (
    <div className="page page--pass page--app">
      <EventsUI />
      <EventsIndex />
    </div>
  )
}
