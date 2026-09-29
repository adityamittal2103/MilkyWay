import type { Metadata } from 'next'
import { EditorialPage } from '@/components/ui/EditorialPage'
import { PARTNERS } from '@/data/partners'
import { FESTIVAL } from '@/data/festival'
import { TransitionLink } from '@/components/navigation/TransitionLink'

export const metadata: Metadata = {
  title: 'Partners',
  description: `Partners and sponsors of ${FESTIVAL.name} at ${FESTIVAL.venue.name}.`,
  alternates: { canonical: '/partners' },
}

export default function PartnersPage() {
  return (
    <EditorialPage index="08" label="Partners" title={['Docking', 'slots']} lead={PARTNERS.length ? 'The crews keeping the Milky Way in orbit.' : 'Partner announcements are on their way.'}>
      {PARTNERS.length > 0 ? (
        <ul className="partner-list">
          {PARTNERS.map((p) => (
            <li key={p.id}>
              <span className="mono dust">{p.tier}</span> {p.url ? <a href={p.url}>{p.name}</a> : p.name}
            </li>
          ))}
        </ul>
      ) : (
        <section className="ed-section">
          <h2 className="ed-h mono">Partner with Milky Way</h2>
          <div className="body-copy">
            <p>
              Brands can dock inside the world itself, whether a sector, a constellation or a transmission, instead of a logo strip at the bottom
              of a page. Partnership enquiries open with the official announcement.
            </p>
            <TransitionLink href="/contact" label="Contact" className="go go--ion" cursor="enter">
              Contact <span className="go__arrow">→</span>
            </TransitionLink>
          </div>
        </section>
      )}
    </EditorialPage>
  )
}
