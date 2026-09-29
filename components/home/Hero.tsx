'use client'
import { useEffect, useRef, useState } from 'react'
import { FESTIVAL } from '@/data/festival'
import { KineticWordmark } from '@/components/motion/KineticWordmark'

/**
 * Chapter 03, THE MILKY WAY: the wordmark fills the viewport over the galaxy, contrasted with
 * tiny system metadata. It assembles when the chapter arrives, not before.
 */
export function Hero() {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShow(true), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className={`hero ${show ? 'is-in' : ''}`}>
      <p className="hero__org mono">
        <span>{FESTIVAL.organiser}</span>
        <span className="dust">presents</span>
        <span className="hero__coord dust">RA 17h 45m · DEC −29° · galactic core bearing</span>
      </p>
      <h1 className="hero__title">
        <KineticWordmark lines={['Milky', 'Way']} show={show} className="display" />
      </h1>
      <div className="hero__meta">
        <p className="hero__desc">
          <span className="serif">an</span> {FESTIVAL.descriptor}
        </p>
        <dl className="hero__facts mono">
          <div>
            <dt className="dust">Theme</dt>
            <dd>{FESTIVAL.theme}</dd>
          </div>
          <div>
            <dt className="dust">Venue</dt>
            <dd>
              {FESTIVAL.venue.name}, {FESTIVAL.venue.city}
            </dd>
          </div>
          <div>
            <dt className="dust">Dates</dt>
            <dd>{FESTIVAL.dates ? `${FESTIVAL.dates[0]} → ${FESTIVAL.dates[1]}` : 'On transmission'}</dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
