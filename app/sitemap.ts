import type { MetadataRoute } from 'next'
import { FESTIVAL } from '@/data/festival'
import { EVENTS } from '@/data/provisional/events'
import { ARTISTS } from '@/data/artists'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = FESTIVAL.siteUrl
  const routes = ['', '/events', '/venue', '/schedule', '/competitions', '/artists', '/register', '/about', '/partners', '/faq', '/contact']
  return [
    ...routes.map((r) => ({ url: `${base}${r}`, changeFrequency: 'weekly' as const, priority: r === '' ? 1 : 0.7 })),
    ...EVENTS.map((e) => ({ url: `${base}/events/${e.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
    // confirmed artists only: test transmissions are not indexed
    ...ARTISTS.map((a) => ({ url: `${base}/artists/${a.id}`, changeFrequency: 'weekly' as const, priority: 0.6 })),
  ]
}
