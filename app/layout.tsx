import type { Metadata, Viewport } from 'next'
import { Anybody, Instrument_Sans, IBM_Plex_Mono, Instrument_Serif } from 'next/font/google'
import { Experience } from '@/components/Experience'
import { FESTIVAL } from '@/data/festival'
import '@/styles/globals.css'
import '@/styles/world-labels.css'
import '@/styles/pages.css'
import '@/styles/hud.css'

// Display: the width axis carries the "stretch at warp" interaction
const anybody = Anybody({ subsets: ['latin'], axes: ['wdth'], variable: '--font-anybody', display: 'swap' })
const instrument = Instrument_Sans({ subsets: ['latin'], axes: ['wdth'], variable: '--font-instrument', display: 'swap' })
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono', display: 'swap' })
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['italic'], variable: '--font-instrument-serif', display: 'swap' })

const title = `${FESTIVAL.name}: ${FESTIVAL.organiser} ${FESTIVAL.descriptor}`
const description = `${FESTIVAL.name} is ${FESTIVAL.organiser}'s ${FESTIVAL.descriptor.toLowerCase()} at ${FESTIVAL.venue.name}, ${FESTIVAL.venue.city}. Theme: ${FESTIVAL.theme}. Fly the venue, find events, board the Milky Way.`

export const metadata: Metadata = {
  metadataBase: new URL(FESTIVAL.siteUrl),
  title: { default: title, template: `%s · ${FESTIVAL.name}` },
  description,
  applicationName: FESTIVAL.name,
  keywords: ['Milky Way', "Masters' Union", 'youth cultural fest', 'college fest Delhi', 'Yashobhoomi', 'Deep Space', 'IICC Dwarka'],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: FESTIVAL.name,
    title,
    description,
    url: '/',
    locale: 'en_IN',
  },
  twitter: { card: 'summary_large_image', title, description },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#030409',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Festival',
  name: FESTIVAL.name,
  description,
  organizer: { '@type': 'Organization', name: FESTIVAL.organiser },
  location: {
    '@type': 'Place',
    name: `${FESTIVAL.venue.name} (${FESTIVAL.venue.formal})`,
    address: { '@type': 'PostalAddress', addressLocality: `${FESTIVAL.venue.locality}, ${FESTIVAL.venue.city}`, addressCountry: 'IN' },
  },
  // startDate/endDate are added automatically once FESTIVAL.dates is set
  ...(FESTIVAL.dates ? { startDate: FESTIVAL.dates[0], endDate: FESTIVAL.dates[1] } : {}),
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${anybody.variable} ${instrument.variable} ${plexMono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* lets CSS hide pre-animation states only when JS will run them (no-JS sees everything) */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Experience />
        <main id="main">{children}</main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  )
}
