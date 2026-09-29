import type { Metadata } from 'next'
import { EditorialPage } from '@/components/ui/EditorialPage'
import { FAQ } from '@/data/faq'
import { FESTIVAL } from '@/data/festival'

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Frequently asked questions about ${FESTIVAL.name} at ${FESTIVAL.venue.name}.`,
  alternates: { canonical: '/faq' },
}

export default function FaqPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <EditorialPage index="09" label="FAQ" title={['Questions', 'from the ground']}>
      <div className="faq">
        {FAQ.map((f, i) => (
          <details key={f.q} className="faq__item" open={i === 0}>
            <summary data-cursor="target">
              <span className="mono dust">{String(i + 1).padStart(2, '0')}</span>
              <span className="faq__q">{f.q}</span>
              <span className="faq__icon" aria-hidden="true" />
            </summary>
            <p className="body-copy">{f.a}</p>
          </details>
        ))}
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </EditorialPage>
  )
}
