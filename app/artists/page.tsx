import type { Metadata } from 'next'
import { ARTISTS, TRANSMISSIONS } from '@/data/artists'
import { FESTIVAL } from '@/data/festival'
import { RevealLines, Fade } from '@/components/motion/Reveal'
import { SignalNetwork } from '@/components/artists/SignalNetwork'

export const metadata: Metadata = {
  title: 'Artists: Transmissions',
  description: `The ${FESTIVAL.name} line-up arrives as transmissions from deep space: each artist's portrait is decoded from their signal.`,
  alternates: { canonical: '/artists' },
}

export default function ArtistsPage() {
  const announced = ARTISTS.length > 0
  return (
    <div className="page page--transmissions">
      <header className="ed-head sn-head">
        <p className="ch__index mono">
          <span>05</span> Artists
        </p>
        <RevealLines as="h1" className="title title--hero" lines={['Transmissions']} force />
        <Fade className="lead">
          <p>{announced ? 'Every artist arrives as a signal. Pick one and decode it.' : 'The line-up is still decrypting. These test transmissions show how each artist will arrive: pick a signal and decode it.'}</p>
        </Fade>
        {!announced && (
          <p className="sn-head__flag mono">
            Test transmissions · placeholder identities · artists to be announced by {FESTIVAL.organiser}
          </p>
        )}
      </header>
      <SignalNetwork artists={TRANSMISSIONS} />
    </div>
  )
}
