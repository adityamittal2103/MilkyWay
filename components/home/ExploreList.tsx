'use client'
import { useEffect, useState } from 'react'
import { ZONES } from '@/data/zones'
import { exploreIndex, JOURNEY_UNITS } from '@/lib/journey'
import { live, useWorld } from '@/lib/store'
import { SectorGlyph } from '@/components/ui/SectorGlyph'

/** The explore chapter's sector list, synced to the sector the camera is pointing at. */
export function ExploreList() {
  const [active, setActive] = useState(-1)
  useEffect(() => {
    let raf = 0
    let last = -2
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const st = useWorld.getState()
      const hov = ZONES.findIndex((z) => z.id === st.hoveredZone)
      const i = hov >= 0 ? hov : exploreIndex(live.journey * JOURNEY_UNITS)
      if (i !== last) {
        last = i
        setActive(i)
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <ol className="explore__list">
      {ZONES.map((z, i) => (
        <li
          key={z.id}
          className={`explore__item${i === active ? ' is-on' : ''}`}
          style={{ ['--accent' as string]: z.accent }}
          onMouseEnter={() => useWorld.getState().set({ hoveredZone: z.id })}
          onMouseLeave={() => useWorld.getState().set({ hoveredZone: null })}
        >
          <span className="explore__glyph">
            <SectorGlyph glyph={z.glyph} size={34} />
          </span>
          <span className="explore__code mono">{z.code}</span>
          <span className="explore__name">{z.name}</span>
          <span className="explore__use mono">{z.use}</span>
        </li>
      ))}
    </ol>
  )
}
