import type { Metadata } from 'next'
import { EditorialPage } from '@/components/ui/EditorialPage'
import { FESTIVAL } from '@/data/festival'
import { TransitionLink } from '@/components/navigation/TransitionLink'

export const metadata: Metadata = {
  title: 'Contact',
  description: `Contact the ${FESTIVAL.name} team.`,
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  const { email, instagram } = FESTIVAL.contact
  return (
    <EditorialPage index="10" label="Contact" title={['Open a', 'channel']}>
      {email || instagram ? (
        <dl className="contact-list">
          {email && (
            <div>
              <dt className="mono dust">Email</dt>
              <dd>
                <a className="contact-list__big" href={`mailto:${email}`}>
                  {email}
                </a>
              </dd>
            </div>
          )}
          {instagram && (
            <div>
              <dt className="mono dust">Instagram</dt>
              <dd>
                <a className="contact-list__big" href={`https://instagram.com/${instagram}`}>
                  @{instagram}
                </a>
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <section className="ed-section">
          <h2 className="ed-h mono">Channels</h2>
          <div className="body-copy">
            <p>Official contact channels will be published here with the festival announcement. Until then, the answers you need are probably in the FAQ.</p>
            <TransitionLink href="/faq" label="FAQ" className="go go--ion" cursor="enter">
              Read the FAQ <span className="go__arrow">→</span>
            </TransitionLink>
          </div>
        </section>
      )}
      <section className="ed-section">
        <h2 className="ed-h mono">Venue</h2>
        <div className="body-copy">
          <p>
            {FESTIVAL.venue.name}, {FESTIVAL.venue.formal}
            <br />
            {FESTIVAL.venue.locality}, {FESTIVAL.venue.city}
          </p>
        </div>
      </section>
    </EditorialPage>
  )
}
