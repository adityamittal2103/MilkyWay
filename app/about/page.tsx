import type { Metadata } from 'next'
import { EditorialPage } from '@/components/ui/EditorialPage'
import { FESTIVAL } from '@/data/festival'
import { TransitionLink } from '@/components/navigation/TransitionLink'

export const metadata: Metadata = {
  title: 'About',
  description: `About ${FESTIVAL.name}: ${FESTIVAL.organiser}'s ${FESTIVAL.descriptor.toLowerCase()} at ${FESTIVAL.venue.name}, and how this site turns the venue into a galaxy.`,
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <EditorialPage
      index="07"
      label="About"
      title={['A festival', 'drawn in stars']}
      lead={
        <>
          {FESTIVAL.name} is {FESTIVAL.organiser}&apos;s {FESTIVAL.descriptor.toLowerCase()}, themed <span className="serif">{FESTIVAL.theme}</span>, at{' '}
          {FESTIVAL.venue.name}, {FESTIVAL.venue.city}.
        </>
      }
    >
      <section className="ed-section">
        <h2 className="ed-h mono">The idea</h2>
        <div className="body-copy">
          <p>
            Most festival sites put a venue map on a page. We did it the other way round: the map <em>is</em> the site. The galaxy you fly
            through on the way in collapses into the festival floor plan. Every wall, stage and light in it comes from the real venue model.
          </p>
          <p>
            Categories become constellations, days become orbits, and registration becomes boarding. It&apos;s space language used only where it
            makes things easier to find.
          </p>
        </div>
      </section>
      <section className="ed-section">
        <h2 className="ed-h mono">The venue</h2>
        <div className="body-copy">
          <p>
            {FESTIVAL.venue.name} is the {FESTIVAL.venue.formal} in {FESTIVAL.venue.locality}, {FESTIVAL.venue.city}. The 3D map is built from
            the festival&apos;s own floor plan: 3,653 objects and six million triangles, rebuilt into a model light enough for a phone.
          </p>
          <TransitionLink href="/venue" label="Land at Yashobhoomi" className="go go--ion" cursor="enter">
            Open the venue map <span className="go__arrow">→</span>
          </TransitionLink>
        </div>
      </section>
      <section className="ed-section">
        <h2 className="ed-h mono">The craft</h2>
        <div className="body-copy">
          <p>
            <strong>JUGAAD-1</strong> (hull MW-01) is a student-built interdimensional festival craft. One engine is bigger than the other, the
            dish is &ldquo;for the aux cable&rdquo;, and the antenna never stops wobbling. It carries you between every page. Click it if you
            want to see it show off.
          </p>
        </div>
      </section>
      <section className="ed-section">
        <h2 className="ed-h mono">{FESTIVAL.organiser}</h2>
        <div className="body-copy">
          <p className="dust">The organiser&apos;s profile will be published here with the official festival announcement.</p>
        </div>
      </section>
    </EditorialPage>
  )
}
