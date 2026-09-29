import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { TRANSMISSIONS, transmissionById } from '@/data/artists'
import { categoryById } from '@/data/categories'
import { FESTIVAL } from '@/data/festival'
import { TransmissionUI } from '@/components/artists/TransmissionUI'

export function generateStaticParams() {
  return TRANSMISSIONS.map((a) => ({ id: a.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const a = transmissionById(id)
  if (!a) return {}
  const what = a.provisional ? `A test transmission for the ${FESTIVAL.name} line-up (artist to be announced)` : `${a.name} at ${FESTIVAL.name}`
  return {
    title: `${a.name}: Transmission`,
    description: `${what}. ${categoryById(a.genre)?.name ?? ''} at ${FESTIVAL.venue.name}.`,
    alternates: { canonical: `/artists/${a.id}` },
    robots: a.provisional ? { index: false } : undefined,
  }
}

export default async function TransmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!transmissionById(id)) notFound()
  return (
    <div className="page page--transmission">
      <TransmissionUI id={id} />
    </div>
  )
}
