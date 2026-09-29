import { Hero } from '@/components/home/Hero'
import { VoidPrompt } from '@/components/home/VoidPrompt'
import { ExploreList } from '@/components/home/ExploreList'
import { ExploreCall } from '@/components/home/ExploreCall'
import { RevealLines, Fade } from '@/components/motion/Reveal'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { FESTIVAL } from '@/data/festival'
import { ZONES } from '@/data/zones'
import { PLANETS, planetEvents } from '@/data/planets'
import { SiteFooter } from '@/components/ui/SiteFooter'

/**
 * THE JOURNEY. Scroll = travel, in eight chapters:
 *   VOID → THE GALAXY → THE MILKY WAY → THE APPROACH → YASHOBHOOMI → LANDING → THE UNIVERSE INSIDE → EXPLORE
 * 10 viewport units in total (approach + Yashobhoomi 1.5, inside 2). Every chapter is real,
 * crawlable HTML; the camera path in lib/director.ts is keyed to these sections.
 */
export default function Home() {
  return (
    <>
      <div className="journey" data-journey>
        {/* 01 · VOID */}
        <section className="ch ch--void" data-u="0" data-h="1" aria-label="Void">
          <VoidPrompt />
        </section>

        {/* 02 · THE GALAXY */}
        <section className="ch ch--galaxy" data-u="1" data-h="1" aria-labelledby="ch-galaxy">
          <div className="ch__col ch__col--left">
            <p className="ch__index mono">
              <span>02</span> The galaxy
            </p>
            <RevealLines as="h2" className="title" lines={['Hundreds of', 'billions of stars']} />
            <Fade className="body-copy ch__body" delay={250}>
              <p>
                <span className="serif">One of them is throwing a festival.</span> Like the Sun, it sits on an outer arm of the
                Milky Way, a long way from the core, where the view is best.
              </p>
            </Fade>
            <p className="mono dust ch__meta">Barred spiral · 2 major arms · 2 minor · rotating very, very slowly</p>
            <span id="ch-galaxy" className="sr-only">
              The galaxy
            </span>
          </div>
        </section>

        {/* 03 · THE MILKY WAY */}
        <section className="ch ch--milkyway" data-u="2" data-h="1" aria-label="Milky Way">
          <Hero />
        </section>

        {/* 04 · THE APPROACH */}
        <section className="ch ch--approach" data-u="3" data-h="1.5" aria-labelledby="ch-approach">
          <div className="sticky">
            <div className="ch__col ch__col--right">
              <p className="ch__index mono">
                <span>04</span> The approach
              </p>
              <RevealLines as="h2" className="title" lines={['Five worlds', 'orbit the festival']} />
              <ul className="worlds">
                {PLANETS.map((p, i) => (
                  <li key={p.id} style={{ ['--accent' as string]: p.accent, ['--i' as string]: i }}>
                    <span className="worlds__ring" aria-hidden="true" />
                    <span className="worlds__name">{p.name}</span>
                    <span className="worlds__group mono">
                      {p.group} · {planetEvents(p).length}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mono dust ch__meta">Each world holds a family of events · hover one on the way past</p>
              <span id="ch-approach" className="sr-only">
                The approach
              </span>
            </div>
          </div>
        </section>

        {/* 05 · YASHOBHOOMI: the reveal */}
        <section className="ch ch--yashobhoomi" data-u="4.5" data-h="1.5" aria-labelledby="ch-land">
          <div className="sticky">
            <div className="land">
              <div className="land__top">
                <p className="ch__index mono">
                  <span>05</span> Yashobhoomi
                </p>
                <RevealLines as="h2" className="land__wait title title--hero" lines={['Wait.']} />
              </div>
              <RevealLines as="p" className="land__this title" delay={650} lines={['This is', FESTIVAL.venue.name + '.']} />
              <Fade className="land__caption mono" delay={1100}>
                <p>
                  The structure you are approaching is the festival itself: every wall, stage and bulb comes straight from the venue&apos;s own
                  floor plan, drawn in light.
                </p>
              </Fade>
              <span id="ch-land" className="sr-only">
                Arrive at {FESTIVAL.venue.name}
              </span>
            </div>
          </div>
        </section>

        {/* 06 · LANDING */}
        <section className="ch ch--landing" data-u="6" data-h="1" aria-labelledby="ch-landing">
          <div className="ch__col ch__col--right ch__col--low">
            <p className="ch__index mono">
              <span>06</span> Landing
            </p>
            <RevealLines as="h2" className="title" lines={['Touchdown']} />
            <Fade className="body-copy ch__body" delay={200}>
              <p>
                One hall, redrawn from the festival floor plan: {ZONES.length} sectors, a stage on the south wall, an arch tunnel at the gate and
                two thousand bulbs hung along the north side.
              </p>
            </Fade>
            <span id="ch-landing" className="sr-only">
              Landing
            </span>
          </div>
        </section>

        {/* 07 · THE UNIVERSE INSIDE (two units: the list walks while the camera crosses the hall) */}
        <section className="ch ch--inside" data-u="7" data-h="2" aria-labelledby="ch-inside">
          <div className="explore">
            <div className="explore__head">
              <p className="ch__index mono">
                <span>07</span> The universe inside
              </p>
              <RevealLines as="h2" className="title" lines={[`${ZONES.length} sectors.`, 'Every event', 'a star above them.']} />
              <p className="provisional">Sector uses provisional</p>
              <TransitionLink href="/venue" label="Land at Yashobhoomi" className="go go--ion" cursor="enter">
                Open the venue map <span className="go__arrow">→</span>
              </TransitionLink>
            </div>
            <ExploreList />
            <span id="ch-inside" className="sr-only">
              The universe inside
            </span>
          </div>
        </section>

        {/* 08 · EXPLORE */}
        <section className="ch ch--explore-call" data-u="9" data-h="1" aria-labelledby="ch-explore">
          <div className="explore-wrap">
            <p className="ch__index mono">
              <span>08</span> Explore
            </p>
            <RevealLines as="h2" className="title title--hero" lines={['Take the', 'controls']} />
            <p className="explore-wrap__sub">
              <span className="serif">The story ends here. The universe doesn&apos;t.</span> Fly to any world or sector, filter by what you&apos;re into and
              watch the festival rearrange itself.
            </p>
            <ExploreCall />
            <span id="ch-explore" className="sr-only">
              Explore
            </span>
          </div>
        </section>
      </div>
      <SiteFooter />
    </>
  )
}
