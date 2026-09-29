import type { Metadata } from 'next'
import { RegisterUI } from '@/components/register/RegisterUI'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'Register: Board the Milky Way',
  description: `Register for ${FESTIVAL.name}, ${FESTIVAL.organiser}'s ${FESTIVAL.descriptor.toLowerCase()} at ${FESTIVAL.venue.name}. Takes under a minute.`,
  alternates: { canonical: '/register' },
}

export default function RegisterPage() {
  return (
    <div className="page page--register">
      <RegisterUI />
    </div>
  )
}
