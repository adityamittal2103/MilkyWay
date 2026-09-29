'use client'
import { useWorld } from '@/lib/store'
import { TransitionLink } from '@/components/navigation/TransitionLink'

/** Chapter 08, EXPLORE: the story hands over the controls. */
export function ExploreCall() {
  return (
    <div className="explore-call">
      <TransitionLink href="/explore" label="Explore the Milky Way" className="explore-call__main" cursor="enter" data-cursor-label="TAKE CONTROL">
        <span className="explore-call__ring" aria-hidden="true" />
        <span className="explore-call__label">Explore the Milky Way</span>
        <span className="explore-call__sub mono">Free flight · worlds · sectors · events</span>
      </TransitionLink>
      <div className="explore-call__row">
        <button type="button" className="go go--ion" onClick={() => useWorld.getState().set({ filterOpen: true })} data-cursor="target">
          What are you into? <span className="go__arrow">◎</span>
        </button>
        <TransitionLink href="/events" label="Enter the Orbit" className="go" cursor="target">
          Events <span className="go__arrow">→</span>
        </TransitionLink>
        <TransitionLink href="/schedule" label="Mission Timeline" className="go" cursor="target">
          Schedule <span className="go__arrow">→</span>
        </TransitionLink>
        <TransitionLink href="/register" label="Board the Milky Way" className="board" cursor="pulse" data-cursor-label="BOARD">
          <span className="board__flame" aria-hidden="true" />
          Board now
        </TransitionLink>
      </div>
    </div>
  )
}
