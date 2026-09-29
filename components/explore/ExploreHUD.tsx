'use client'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { live, useWorld, type NavTarget } from '@/lib/store'
import { ZONES, zoneById } from '@/data/zones'
import { PLANETS, planetById, planetEvents } from '@/data/planets'
import { eventBySlug, eventsInZone } from '@/data/provisional/events'
import { categoryById } from '@/data/categories'
import { SECTIONS } from '@/data/sections'
import { FESTIVAL } from '@/data/festival'
import { applyFilter } from '@/lib/filter'
import { audio } from '@/lib/audio'
import { parentOf } from '@/components/world/NavInput'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { SectorGlyph } from '@/components/ui/SectorGlyph'
import { Radar } from './Radar'
import { EventPanel } from './EventPanel'

/**
 * EXPLORE THE MILKY WAY. The world becomes the interface; this HUD makes sure you always know
 * where you are (breadcrumb + radar), where you can go (nav computer), what you're looking at
 * (context panel) and how to get back (Esc / breadcrumb / return link).
 */
const TOTAL_PLACES = ZONES.length + PLANETS.length + SECTIONS.length

function crumbs(n: NavTarget): { label: string; to: NavTarget }[] {
  const out: { label: string; to: NavTarget }[] = [{ label: 'Milky Way', to: { kind: 'space' } }, { label: 'Orion arm', to: { kind: 'galaxy' } }, { label: 'Yashobhoomi system', to: { kind: 'system' } }]
  if (n.kind === 'space') return out.slice(0, 1)
  if (n.kind === 'galaxy') return out.slice(0, 2)
  if (n.kind === 'system') return out
  if (n.kind === 'planet') return [...out, { label: planetById(n.id)?.name ?? '', to: n }]
  out.push({ label: 'Yashobhoomi', to: { kind: 'venue' } })
  if (n.kind === 'venue') return out
  if (n.kind === 'zone') return [...out, { label: `${zoneById(n.id)?.code} ${zoneById(n.id)?.name}`, to: n }]
  const e = eventBySlug(n.id)
  const z = zoneById(e?.zone)
  return [...out, { label: `${z?.code} ${z?.name}`, to: { kind: 'zone', id: z?.id ?? '' } }, { label: e?.title ?? '', to: n }]
}

export function ExploreHUD() {
  const nav = useWorld((s) => s.nav)
  const filter = useWorld((s) => s.filter)
  const discovered = useWorld((s) => s.discovered)
  const coarse = useWorld((s) => s.coarse)
  const params = useSearchParams()
  const [navOpen, setNavOpen] = useState(true)
  const coords = useRef<HTMLSpanElement>(null)
  const f = applyFilter(filter)
  const filtered = f.def.id !== 'all'
  const places = discovered.filter((d) => /^(zone|planet|sky):/.test(d)).length

  // deep links (?to=planet:sonic) also work between two explore URLs
  useEffect(() => {
    const to = params.get('to')
    if (!to) return
    const [kind, id] = to.split(':')
    const n = (['planet', 'zone', 'event'].includes(kind) && id ? { kind, id } : { kind }) as NavTarget
    useWorld.getState().set({ nav: n, ...(n.kind === 'event' ? { selectedEvent: n.id } : {}) })
  }, [params])

  // narrow screens start with the nav computer folded
  useEffect(() => {
    if (window.innerWidth < 900) setNavOpen(false)
  }, [])

  // coordinates readout (per frame, no React)
  useEffect(() => {
    let raf = 0
    const f3 = (v: number) => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v)).toString().padStart(5, '0')
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (coords.current) coords.current.textContent = `X ${f3(live.cam.x)}  Y ${f3(live.cam.y)}  Z ${f3(live.cam.z)}`
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const go = (n: NavTarget) => {
    const st = useWorld.getState()
    st.set({ nav: n, selectedZone: n.kind === 'zone' ? n.id : n.kind === 'event' ? (eventBySlug(n.id)?.zone ?? null) : null, selectedEvent: n.kind === 'event' ? n.id : null })
    if (n.kind === 'zone' || n.kind === 'planet') st.discover(`${n.kind}:${n.id}`)
    audio.engage()
    if (window.innerWidth < 900) setNavOpen(false)
  }
  const isHere = (n: NavTarget) => n.kind === nav.kind && (!('id' in n) || ('id' in nav && nav.id === n.id))
  const up = parentOf(nav)

  const planet = nav.kind === 'planet' ? planetById(nav.id) : null
  const zone = nav.kind === 'zone' ? zoneById(nav.id) : null

  return (
    <>
      {/* location indicator */}
      <nav className="hud-loc" aria-label="You are here" data-ui>
        <ol className="hud-loc__crumbs mono">
          {crumbs(nav).map((c, i, a) => (
            <li key={i}>
              {i < a.length - 1 ? (
                <button type="button" onClick={() => go(c.to)} data-cursor="target">
                  {c.label}
                </button>
              ) : (
                <span aria-current="location">{c.label}</span>
              )}
            </li>
          ))}
        </ol>
        <span ref={coords} className="hud-loc__coords mono dust" aria-hidden="true" />
      </nav>

      {/* nav computer */}
      <aside className={`holo hud-nav${navOpen ? ' is-open' : ''}`} aria-label="Destinations" data-ui>
        <header className="holo__head">
          <button type="button" className="holo__sys mono hud-nav__toggle" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)} data-cursor="target">
            NAV · destinations {navOpen ? '−' : '+'}
          </button>
        </header>
        <div className="hud-nav__body">
          <p className="hud-nav__group mono dust">Space</p>
          <ul>
            {[
              { n: { kind: 'space' } as NavTarget, l: 'Deep space' },
              { n: { kind: 'galaxy' } as NavTarget, l: 'The Milky Way' },
              { n: { kind: 'system' } as NavTarget, l: 'Yashobhoomi system' },
            ].map((d) => (
              <li key={d.l}>
                <button type="button" className={`hud-dest${isHere(d.n) ? ' is-here' : ''}`} onClick={() => go(d.n)} data-cursor="enter" data-cursor-label="FLY">
                  {d.l}
                </button>
              </li>
            ))}
          </ul>
          <p className="hud-nav__group mono dust">Worlds</p>
          <ul>
            {PLANETS.map((p) => {
              const n = { kind: 'planet', id: p.id } as NavTarget
              return (
                <li key={p.id}>
                  <button type="button" className={`hud-dest${isHere(n) ? ' is-here' : ''}${filtered && !f.planets.has(p.id) ? ' is-dim' : ''}`} style={{ ['--accent' as string]: p.accent }} onClick={() => go(n)} data-cursor="enter" data-cursor-label="FLY">
                    <span className="hud-dest__dot" />
                    {p.name} <span className="mono dust">{p.group}</span>
                    {discovered.includes(`planet:${p.id}`) && <span className="hud-dest__seen" aria-label="visited" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="hud-nav__group mono dust">Station</p>
          <ul>
            <li>
              <button type="button" className={`hud-dest${isHere({ kind: 'venue' }) ? ' is-here' : ''}`} onClick={() => go({ kind: 'venue' })} data-cursor="enter" data-cursor-label="LAND">
                Yashobhoomi · the hall
              </button>
            </li>
            {ZONES.map((z) => {
              const n = { kind: 'zone', id: z.id } as NavTarget
              const count = f.zoneCount.get(z.id) ?? 0
              return (
                <li key={z.id}>
                  <button type="button" className={`hud-dest hud-dest--zone${isHere(n) ? ' is-here' : ''}${filtered && !count ? ' is-dim' : ''}${f.suggested === z.id ? ' is-suggested' : ''}`} style={{ ['--accent' as string]: z.accent }} onClick={() => go(n)} data-cursor="enter" data-cursor-label="LAND">
                    <SectorGlyph glyph={z.glyph} size={16} />
                    <span className="mono dust">{z.code}</span> {z.name}
                    {filtered && count > 0 && <span className="hud-dest__count mono">{count}</span>}
                    {discovered.includes(`zone:${z.id}`) && <span className="hud-dest__seen" aria-label="visited" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>

      {/* context panel */}
      <section className="hud-ctx" aria-live="polite" aria-label="Current destination" data-ui>
        {nav.kind === 'event' && <EventPanel slug={nav.id} onClose={() => go({ kind: 'zone', id: eventBySlug(nav.id)?.zone ?? 'supergiant' })} />}
        {planet && (
          <article className="holo ctx-panel" style={{ ['--accent' as string]: planet.accent }}>
            <header className="holo__head">
              <span className="holo__sys mono">WORLD · {planet.group.toUpperCase()}</span>
            </header>
            <h2 className="ctx-panel__title">{planet.name}</h2>
            <p className="ctx-panel__line">{planet.line}</p>
            <p className="mono dust ctx-panel__meta">
              Orbit {Math.round(planet.orbit / 100)} · radius {planet.radius / 100} · {planet.moons.length ? planet.moons.map((m) => m.name).join(', ') : 'no moons'}
            </p>
            <ul className="ctx-panel__list">
              {planetEvents(planet).map((e) => (
                <li key={e.slug}>
                  <button type="button" className="ev-row" onClick={() => go({ kind: 'event', id: e.slug })} data-cursor="event">
                    <span className="ev-row__title">{e.title}</span>
                    <span className="ev-row__meta mono">
                      {categoryById(e.category)?.name} · {zoneById(e.zone)?.name}
                    </span>
                    <span className="ev-row__arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="provisional">Provisional programme</p>
          </article>
        )}
        {zone && (
          <article className="holo ctx-panel" style={{ ['--accent' as string]: zone.accent }}>
            <header className="holo__head">
              <span className="holo__sys mono">
                SECTOR · {zone.code} · {zone.subtitle.toUpperCase()}
              </span>
            </header>
            <h2 className="ctx-panel__title">{zone.name}</h2>
            <p className="ctx-panel__line">{zone.description}</p>
            <p className="mono dust ctx-panel__meta">
              {zone.use} · <span className="provisional">Provisional</span>
            </p>
            <ul className="ctx-panel__list">
              {eventsInZone(zone.id).map((e) => (
                <li key={e.slug}>
                  <button type="button" className={`ev-row${filtered && !f.events.has(e.slug) ? ' is-dim' : ''}`} onClick={() => go({ kind: 'event', id: e.slug })} data-cursor="event">
                    <span className="ev-row__title">{e.title}</span>
                    <span className="ev-row__meta mono">
                      {e.kind} · {e.start}
                    </span>
                    <span className="ev-row__arrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                </li>
              ))}
              {eventsInZone(zone.id).length === 0 && <li className="mono dust">No events pinned here yet.</li>}
            </ul>
          </article>
        )}
        {(nav.kind === 'system' || nav.kind === 'venue' || nav.kind === 'space' || nav.kind === 'galaxy') && (
          <article className="holo ctx-panel ctx-panel--quiet">
            <header className="holo__head">
              <span className="holo__sys mono">{nav.kind === 'venue' ? 'STATION · THE HALL' : nav.kind === 'system' ? 'SYSTEM · YASHOBHOOMI' : 'SPACE'}</span>
            </header>
            <p className="ctx-panel__line">
              {nav.kind === 'space' && 'Hundreds of billions of stars. One bright point on an outer arm is the festival.'}
              {nav.kind === 'galaxy' && 'The Milky Way, barred spiral. Yashobhoomi sits on an outer arm, the way the Sun does.'}
              {nav.kind === 'system' && `${FESTIVAL.venue.name} and its five worlds. Pick a world to see what it holds, or land on the station.`}
              {nav.kind === 'venue' && 'The hall, from the festival floor plan. Hover a sector to scan it; click to land; pins are events.'}
            </p>
            {filtered && f.suggested && (
              <button type="button" className="go go--ion" onClick={() => go({ kind: 'zone', id: f.suggested! })} data-cursor="enter" data-cursor-label="FLY">
                Suggested for {f.def.label}: {zoneById(f.suggested)?.name} <span className="go__arrow">→</span>
              </button>
            )}
          </article>
        )}
      </section>

      {/* instruments */}
      <div className="hud-instruments" data-ui>
        <Radar />
        <div className="hud-meta mono">
          <p>
            Charted <b>{places}</b>/{TOTAL_PLACES}
          </p>
          <div className="hud-meta__bar" style={{ ['--p' as string]: places / TOTAL_PLACES }}>
            <i />
          </div>
        </div>
      </div>

      <div className="hud-controls mono" data-ui>
        {up && (
          <button type="button" onClick={() => go(up)} data-cursor="target">
            ← Back out <span className="dust">Esc</span>
          </button>
        )}
        {!coarse && <span className="dust hud-controls__hint">Drag to orbit · scroll to zoom · WASD to move</span>}
        {coarse && <span className="dust hud-controls__hint">Drag to orbit · pinch to zoom · tap to select</span>}
        <TransitionLink href="/" label="The Journey" cursor="target">
          Return to the journey
        </TransitionLink>
      </div>
    </>
  )
}
