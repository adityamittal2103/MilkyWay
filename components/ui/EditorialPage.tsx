import type { ReactNode } from 'react'
import { RevealLines } from '@/components/motion/Reveal'
import { SiteFooter } from './SiteFooter'

/** Calm template for information-dense pages: the universe dims behind, text leads. */
export function EditorialPage({ index, label, title, lead, children }: { index: string; label: string; title: string[]; lead?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="page page--editorial">
        <header className="ed-head">
          <p className="ch__index mono">
            <span>{index}</span> {label}
          </p>
          <RevealLines as="h1" className="title title--hero" lines={title} force />
          {lead && <p className="lead">{lead}</p>}
        </header>
        <div className="ed-body">{children}</div>
      </div>
      <SiteFooter />
    </>
  )
}
