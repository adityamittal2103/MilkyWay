import { FESTIVAL } from '@/data/festival'
import { NAV, NAV_SECONDARY } from '@/data/nav'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { Insignia } from './Insignia'

/** Conventional, fully crawlable footer: the "real website" underneath the universe. */
export function SiteFooter() {
  return (
    <footer className="footer" data-ui>
      <div className="footer__brand">
        <Insignia size={44} />
        <p className="footer__name display">Milky Way</p>
        <p className="mono dust">
          {FESTIVAL.organiser} · {FESTIVAL.descriptor}
        </p>
      </div>
      <nav className="footer__nav" aria-label="Footer">
        <ul>
          {NAV.map((n) => (
            <li key={n.href}>
              <TransitionLink href={n.href} label={n.label} cursor="target">
                <span className="mono dust">{n.code}</span> {n.plain}
              </TransitionLink>
            </li>
          ))}
        </ul>
        <ul>
          {NAV_SECONDARY.map((n) => (
            <li key={n.href}>
              <TransitionLink href={n.href} label={n.label} cursor="target">
                {n.label}
              </TransitionLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="footer__venue mono">
        <p>{FESTIVAL.venue.name}</p>
        <p className="dust">{FESTIVAL.venue.formal}</p>
        <p className="dust">
          {FESTIVAL.venue.locality}, {FESTIVAL.venue.city}
        </p>
        <p className="footer__theme">Theme · {FESTIVAL.theme}</p>
      </div>
    </footer>
  )
}
