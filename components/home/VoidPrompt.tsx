'use client'
import { useWorld } from '@/lib/store'
import { lenis } from '@/components/motion/SmoothScroll'
import { FESTIVAL } from '@/data/festival'

/** Chapter 01, VOID: almost nothing, and the ship. A quiet line and a way in. */
export function VoidPrompt() {
  const done = useWorld((s) => s.introDone)
  const go = () => {
    const y = window.innerHeight
    if (lenis) lenis.scrollTo(y, { duration: 2.2 })
    else window.scrollTo({ top: y, behavior: 'smooth' })
  }
  return (
    <div className={`void ${done ? 'is-in' : ''}`}>
      <p className="void__id mono">
        <span>{FESTIVAL.organiser}</span> <span className="dust">·</span> <span>{FESTIVAL.descriptor}</span> <span className="dust">·</span>{' '}
        <span>
          {FESTIVAL.venue.name}, {FESTIVAL.venue.city}
        </span>
      </p>
      <div className="void__prompt">
        <p className="void__line">
          <span className="serif">Something is out here.</span> Follow it.
        </p>
        <button type="button" className="void__enter mono" onClick={go} data-cursor="enter" data-cursor-label="ENTER">
          <span className="void__ring" aria-hidden="true" />
          Enter the Milky Way
        </button>
      </div>
    </div>
  )
}
