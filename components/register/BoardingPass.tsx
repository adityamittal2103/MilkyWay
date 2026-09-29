'use client'
import { forwardRef } from 'react'
import { FESTIVAL } from '@/data/festival'
import { ZONES } from '@/data/zones'
import { categoryById } from '@/data/categories'
import { Insignia } from '@/components/ui/Insignia'

type Props = {
  name: string
  institution: string
  interests: string[]
  passId: string | null
  mode: 'draft' | 'preview' | 'confirmed'
}

/** The boarding pass: live-updates as you type, then "prints" when you board. */
export const BoardingPass = forwardRef<HTMLDivElement, Props>(function BoardingPass({ name, institution, interests, passId, mode }, ref) {
  const gate = ZONES[0]
  return (
    <div ref={ref} className={`pass pass--${mode}`} aria-label="Boarding pass preview" role="img">
      <div className="pass__main">
        <div className="pass__top">
          <Insignia size={34} />
          <div>
            <p className="pass__brand">Milky Way</p>
            <p className="mono dust">{FESTIVAL.organiser} · Boarding pass</p>
          </div>
          <p className="pass__class mono">Deep Space</p>
        </div>
        <div className="pass__route">
          <div>
            <p className="mono dust">From</p>
            <p className="pass__code">EARTH</p>
          </div>
          <svg viewBox="0 0 120 24" className="pass__traj" aria-hidden="true">
            <path d="M2 20 Q60 -8 118 20" fill="none" stroke="currentColor" strokeDasharray="3 4" />
            <circle cx="118" cy="20" r="3" fill="var(--flare)" />
          </svg>
          <div>
            <p className="mono dust">To</p>
            <p className="pass__code">YASHOBHOOMI</p>
          </div>
        </div>
        <dl className="pass__grid">
          <div className="pass__wide">
            <dt className="mono dust">Passenger</dt>
            <dd className="pass__name">{name || 'Your name'}</dd>
          </div>
          <div className="pass__wide">
            <dt className="mono dust">Launching from</dt>
            <dd>{institution || 'Your college'}</dd>
          </div>
          <div>
            <dt className="mono dust">Gate</dt>
            <dd>
              {gate.code} {gate.name}
            </dd>
          </div>
          <div>
            <dt className="mono dust">Craft</dt>
            <dd>MW-01 Jugaad-1</dd>
          </div>
          <div>
            <dt className="mono dust">Date</dt>
            <dd>{FESTIVAL.dates ? FESTIVAL.dates[0] : 'On transmission'}</dd>
          </div>
          <div>
            <dt className="mono dust">Orbits</dt>
            <dd>{interests.length ? interests.map((i) => categoryById(i)?.name).join(' · ') : 'Open'}</dd>
          </div>
        </dl>
      </div>
      <div className="pass__stub">
        <p className="mono dust">Pass</p>
        <p className="pass__id">{passId ?? 'MW-·······'}</p>
        <div className="pass__bars" aria-hidden="true">
          {Array.from({ length: 28 }, (_, i) => (
            <i key={i} style={{ width: `${1 + (((passId ?? 'x').charCodeAt(i % (passId?.length ?? 1)) + i * 7) % 4)}px` }} />
          ))}
        </div>
        {mode !== 'draft' && <p className={`pass__stamp mono pass__stamp--${mode}`}>{mode === 'confirmed' ? 'Cleared for boarding' : 'Preview pass · not a confirmed seat'}</p>}
      </div>
    </div>
  )
})
