import type { Metadata } from 'next'
import { ScheduleUI } from '@/components/schedule/ScheduleUI'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'Schedule: Mission timeline',
  description: `${FESTIVAL.name} schedule as a mission timeline: each day an orbit, each event a node. Filter by day, category and venue sector, or switch to the list.`,
  alternates: { canonical: '/schedule' },
}

export default function SchedulePage() {
  return (
    <div className="page page--pass page--app page--schedule">
      <ScheduleUI />
    </div>
  )
}
