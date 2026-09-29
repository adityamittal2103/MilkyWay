import type { MetadataRoute } from 'next'
import { FESTIVAL } from '@/data/festival'

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: '/api/' }], sitemap: `${FESTIVAL.siteUrl}/sitemap.xml` }
}
