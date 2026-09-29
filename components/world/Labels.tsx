'use client'
import { useEffect, useRef } from 'react'
import { useWorld } from '@/lib/store'
import { ZONES, zoneById } from '@/data/zones'
import { CATEGORIES } from '@/data/categories'
import { EVENTS, PROVISIONAL_DAYS } from '@/data/provisional/events'
import { PLANETS, planetEvents } from '@/data/planets'
import { SECTION_SKY } from '@/lib/sectionSky'
import { SKY, ORBIT, ORBIT_DAYS, ORBIT_NODES, orbitPoint } from '@/lib/sky'
import { setAnchor } from '@/lib/labels'
import { applyFilter } from '@/lib/filter'
import { S } from './system'

/* anchors are static data: register once */
ZONES.forEach((z) => setAnchor(`zone:${z.id}`, [z.centre[0], 18, z.centre[2]]))
SKY.forEach((s) => {
  const top = s.stars.reduce((a, b) => (b.y > a.y ? b : a), s.stars[0])
  setAnchor(`sky:${s.id}`, [s.centre.x, top.y + 16, s.centre.z])
  s.events.forEach((e) => setAnchor(`ev:${e.slug}`, e.pos))
})
PROVISIONAL_DAYS.forEach((d) => setAnchor(`day:${d.index}`, orbitPoint(d.index, ORBIT.dayStart - 22)))
;[10, 12, 14, 16, 18, 20, 22].forEach((h) => {
  const p = orbitPoint(ORBIT_DAYS - 1, h * 60)
  p.sub(ORBIT.centre).multiplyScalar(1.12).add(ORBIT.centre)
  setAnchor(`hour:${h}`, p)
})
ORBIT_NODES.forEach((n) => setAnchor(`node:${n.slug}`, n.pos))

/** Fades a group of labels with a world channel, without React renders per frame. */
function useChannelOpacity(read: () => number) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (ref.current) ref.current.style.opacity = String(Math.max(0, Math.min(1, read())))
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [read])
  return ref
}
const skyOpacity = () => (S.sky - 0.4) / 0.6
const planetOpacity = () => S.planetLabels
const markerOpacity = () => S.markers * S.reveal
const sectionOpacity = () => (S.sectionSky - 0.3) / 0.7

/**
 * Holographic labels for the 3D world, positioned by <LabelProjector/> inside the canvas.
 * Plain DOM (crisp text, zero React roots in the canvas), aria-hidden: the DOM panels are
 * the accessible equivalent of everything here.
 */
export function WorldLabels() {
  const mode = useWorld((s) => s.mode)
  const nav = useWorld((s) => s.nav)
  const hoveredZone = useWorld((s) => s.hoveredZone)
  const selectedZone = useWorld((s) => s.selectedZone)
  const hoveredCat = useWorld((s) => s.hoveredCategory)
  const selectedCat = useWorld((s) => s.selectedCategory)
  const hoveredEvent = useWorld((s) => s.hoveredEvent)
  const selectedEvent = useWorld((s) => s.selectedEvent)
  const hoveredPlanet = useWorld((s) => s.hoveredPlanet)
  const hoveredConst = useWorld((s) => s.hoveredConstellation)
  const discovered = useWorld((s) => s.discovered)
  const filter = useWorld((s) => s.filter)
  const skyWrap = useChannelOpacity(skyOpacity)
  const planetWrap = useChannelOpacity(planetOpacity)
  const markerWrap = useChannelOpacity(markerOpacity)
  const secWrap = useChannelOpacity(sectionOpacity)

  const f = applyFilter(filter)
  const filtered = f.def.id !== 'all'
  const venueLevel = mode === 'venue' || (mode === 'explore' && (nav.kind === 'venue' || nav.kind === 'zone' || nav.kind === 'event')) || mode === 'home'
  const showSky = mode === 'events' || mode === 'competitions' || mode === 'home'
  const ev = hoveredEvent ? EVENTS.find((e) => e.slug === hoveredEvent) : null
  const selSky = SKY.find((s) => s.id === selectedCat)
  const focusEvent = hoveredEvent ?? selectedEvent ?? (nav.kind === 'event' ? nav.id : null)

  return (
    <div className="labels" aria-hidden="true">
      {/* sectors + event pins on the hall */}
      {venueLevel && (
        <div ref={markerWrap} className="labels__group">
          {mode !== 'home' &&
            ZONES.map((z) => {
              const on = z.id === hoveredZone || z.id === selectedZone || (nav.kind === 'zone' && nav.id === z.id)
              const n = f.zoneCount.get(z.id) ?? 0
              const dim = filtered && !n
              return (
                <div key={z.id} data-label={`zone:${z.id}`} className="label">
                  <div className={`sector-tag${on ? ' is-on' : ''}${dim ? ' is-dim' : ''}`} style={{ ['--accent' as string]: z.accent }}>
                    <span className="sector-tag__code">{z.code}</span>
                    <span className="sector-tag__name">{z.name}</span>
                    {filtered && n > 0 && <span className="sector-tag__count">{f.def.id === 'food' ? 'food' : `${n} ${f.def.label.toLowerCase()}`}</span>}
                  </div>
                </div>
              )
            })}
          {EVENTS.filter((e) => e.slug === focusEvent).map((e) => (
            <div key={e.slug} data-label={`evm:${e.slug}`} className="label label--pin">
              <div className="pin-tag" style={{ ['--accent' as string]: CATEGORIES.find((c) => c.id === e.category)?.accent }}>
                <span className="pin-tag__kind">
                  {e.kind} · {PROVISIONAL_DAYS[e.day]?.label} {e.start}
                </span>
                <span className="pin-tag__title">{e.title}</span>
                {mode !== 'home' && e.slug === hoveredEvent && e.slug !== selectedEvent && !(nav.kind === 'event' && nav.id === e.slug) && <span className="pin-tag__hint">click to fly there</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* category constellations over the hall */}
      {showSky && (
        <div ref={skyWrap} className="labels__group">
          {CATEGORIES.map((c) => {
            const on = c.id === selectedCat || c.id === hoveredCat || (filtered && f.categories.has(c.id))
            return (
              <div key={c.id} data-label={`sky:${c.id}`} className="label">
                <div className={`sky-tag${on ? ' is-on' : ''}${filtered && !f.categories.has(c.id) ? ' is-dim' : ''}`} style={{ ['--accent' as string]: c.accent }}>
                  <span className="sky-tag__cosmic">{c.cosmic}</span>
                  <span className="sky-tag__plain">{c.name}</span>
                </div>
              </div>
            )
          })}
          {mode !== 'home' &&
            selSky?.events.map((e) => {
              const x = EVENTS.find((y) => y.slug === e.slug)!
              return (
                <div key={e.slug} data-label={`ev:${e.slug}`} className="label label--left">
                  <div className="event-star">
                    <span className="event-star__dot" />
                    <span className="event-star__title">{x.title}</span>
                    <span className="event-star__meta">{x.kind}</span>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* the five worlds */}
      {(mode === 'explore' || mode === 'home') && (
        <div ref={planetWrap} className="labels__group">
          {PLANETS.map((p) => {
            const on = p.id === hoveredPlanet || (nav.kind === 'planet' && nav.id === p.id)
            const n = planetEvents(p).length
            return (
              <div key={p.id} data-label={`planet:${p.id}`} className="label">
                <div className={`planet-tag${on ? ' is-on' : ''}${filtered && !f.planets.has(p.id) ? ' is-dim' : ''}`} style={{ ['--accent' as string]: p.accent }}>
                  <span className="planet-tag__ring" />
                  <span className="planet-tag__name">{p.name}</span>
                  <span className="planet-tag__group">
                    {p.group} · {n}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* a visited world's events, riding its orbit */}
      {mode === 'explore' && nav.kind === 'planet' && (
        <div className="labels__group">
          {planetEvents(PLANETS.find((p) => p.id === nav.id)!).map((e) => (
            <div key={e.slug} data-label={`sat:${e.slug}`} className="label label--left">
              <div className="event-star">
                <span className="event-star__dot" />
                <span className="event-star__title">{e.title}</span>
                <span className="event-star__meta">
                  {e.kind} · {zoneById(e.zone)?.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* section constellations: names appear only once discovered or hovered */}
      {(mode === 'explore' || mode === 'home') && (
        <div ref={secWrap} className="labels__group">
          {SECTION_SKY.map((s) => {
            const on = s.id === hoveredConst
            const found = discovered.includes(`sky:${s.id}`)
            if (!on && !found) return null
            return (
              <div key={s.id} data-label={`sec:${s.id}`} className="label">
                <div className={`sec-tag${on ? ' is-on' : ''}`}>
                  <span className="sec-tag__plain">{s.plain}</span>
                  <span className="sec-tag__label">{s.label}</span>
                  {on && <span className="sec-tag__go">click to travel →</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {mode === 'explore' && (nav.kind === 'system' || nav.kind === 'planet' || nav.kind === 'space' || nav.kind === 'galaxy') && (
        <div data-label="station" className="label">
          <div className="station-tag">
            <span className="station-tag__reticle" />
            <span className="station-tag__name">Yashobhoomi</span>
            <span className="station-tag__meta">Festival station · 10 sectors</span>
          </div>
        </div>
      )}

      {mode === 'schedule' && (
        <>
          {PROVISIONAL_DAYS.map((d) => (
            <div key={d.index} data-label={`day:${d.index}`} className="label">
              <span className="orbit-day">{d.label}</span>
            </div>
          ))}
          {[10, 12, 14, 16, 18, 20, 22].map((h) => (
            <div key={h} data-label={`hour:${h}`} className="label">
              <span className="orbit-hour">{String(h).padStart(2, '0')}:00</span>
            </div>
          ))}
          {ev && (
            <div data-label={`node:${ev.slug}`} className="label label--left">
              <div className="orbit-tip">
                <span className="orbit-tip__time">
                  {PROVISIONAL_DAYS[ev.day].label} · {ev.start}–{ev.end}
                </span>
                <span className="orbit-tip__title">{ev.title}</span>
                <span className="orbit-tip__meta">{zoneById(ev.zone)?.name}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
