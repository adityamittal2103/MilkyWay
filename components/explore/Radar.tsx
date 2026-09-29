'use client'
import { useEffect, useRef, useState } from 'react'
import { live, useWorld } from '@/lib/store'
import { ZONES } from '@/data/zones'
import { PLANETS, planetPos } from '@/data/planets'
import { EVENTS } from '@/data/provisional/events'
import { CATEGORIES } from '@/data/categories'
import { EVENT_XZ as EVENT_ANCHORS } from '@/lib/journey'
import { applyFilter } from '@/lib/filter'
import { HALL } from '@/lib/constants'

/**
 * A space-navigation instrument, not a map app. Two scales switch automatically:
 *   SYSTEM · Yashobhoomi at the centre, the five worlds on their orbits (log-scaled)
 *   VENUE  · the hall plan, sectors, event pins, you + your heading
 * The sweep, the bearing line to your destination and the YOU marker update per frame via refs.
 */
type Meta = { walls: number[][] }
const R = 100 // svg radius
const r2 = (n: number) => Math.round(n * 100) / 100
const VENUE_SCALE = 88 / 240 // world → radar units (hall half-width ~220)
const sysR = (d: number) => (Math.log(1 + d / 800) / Math.log(1 + 12000 / 800)) * 88

export function Radar({ compact = false }: { compact?: boolean }) {
  const nav = useWorld((s) => s.nav)
  const mode = useWorld((s) => s.mode)
  const filter = useWorld((s) => s.filter)
  const selectedZone = useWorld((s) => s.selectedZone)
  const selectedEvent = useWorld((s) => s.selectedEvent)
  const [meta, setMeta] = useState<Meta | null>(null)
  const you = useRef<SVGGElement>(null)
  const bearing = useRef<SVGLineElement>(null)
  const readout = useRef<HTMLSpanElement>(null)
  const venueScale = mode === 'venue' || nav.kind === 'venue' || nav.kind === 'zone' || nav.kind === 'event'
  const f = applyFilter(filter)
  const filtered = f.def.id !== 'all'

  useEffect(() => {
    fetch('/data/venue-meta.json')
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {})
  }, [])

  // destination in radar space
  let dest: [number, number] | null = null
  if (venueScale) {
    const evId = nav.kind === 'event' ? nav.id : selectedEvent
    const zId = nav.kind === 'zone' ? nav.id : selectedZone ?? f.suggested
    if (evId && EVENT_ANCHORS.get(evId)) {
      const a = EVENT_ANCHORS.get(evId)!
      dest = [a.x * VENUE_SCALE, a.z * VENUE_SCALE]
    } else if (zId) {
      const z = ZONES.find((x) => x.id === zId)
      if (z) dest = [z.centre[0] * VENUE_SCALE, z.centre[2] * VENUE_SCALE]
    }
  } else if (nav.kind === 'planet') {
    const p = PLANETS.find((x) => x.id === nav.id)
    if (p) {
      const [cx, , cz] = planetPos(p)
      const c = { x: cx, z: cz }
      const d = Math.hypot(c.x, c.z)
      dest = [(c.x / d) * sysR(d), (c.z / d) * sysR(d)]
    }
  }

  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      let x: number
      let y: number
      if (venueScale) {
        x = live.cam.x * VENUE_SCALE
        y = live.cam.z * VENUE_SCALE
      } else {
        const d = Math.hypot(live.cam.x, live.cam.z) || 1
        const r = sysR(d)
        x = (live.cam.x / d) * r
        y = (live.cam.z / d) * r
      }
      // clamp to the rim: "you are beyond this scale" reads as a marker on the edge
      const len = Math.hypot(x, y)
      if (len > 94) {
        x = (x / len) * 94
        y = (y / len) * 94
      }
      const deg = (live.cam.heading * 180) / Math.PI
      you.current?.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${deg.toFixed(1)})`)
      if (bearing.current) {
        bearing.current.setAttribute('x1', x.toFixed(1))
        bearing.current.setAttribute('y1', y.toFixed(1))
      }
      if (readout.current) {
        const dist = dest ? Math.hypot(dest[0] - x, dest[1] - y) / (venueScale ? VENUE_SCALE : 1) : 0
        readout.current.textContent = dest ? `${venueScale ? Math.round(dist) + ' u' : 'bearing locked'}` : venueScale ? 'hall' : 'system'
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [venueScale, dest])

  const go = (n: Parameters<ReturnType<typeof useWorld.getState>['set']>[0]) => useWorld.getState().set(n)
  const hallW = (HALL.max[0] - HALL.min[0]) * VENUE_SCALE
  const hallH = (HALL.max[1] - HALL.min[1]) * VENUE_SCALE

  return (
    <div className={`radar${compact ? ' radar--compact' : ''}`} data-ui>
      <svg viewBox={`${-R - 6} ${-R - 6} ${2 * R + 12} ${2 * R + 12}`} role="group" aria-label={venueScale ? 'Venue radar' : 'System radar'}>
        <defs>
          <radialGradient id="radar-sweep" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform={`scale(${R})`}>
            <stop offset="0" stopColor="var(--ion)" stopOpacity="0.28" />
            <stop offset="1" stopColor="var(--ion)" stopOpacity="0" />
          </radialGradient>
          <clipPath id="radar-clip">
            <circle r={R} />
          </clipPath>
        </defs>
        <circle r={R} className="radar__bg" />
        {[0.33, 0.66].map((k) => (
          <circle key={k} r={R * k} className="radar__ring" />
        ))}
        <line x1={-R} y1={0} x2={R} y2={0} className="radar__axis" />
        <line x1={0} y1={-R} x2={0} y2={R} className="radar__axis" />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * Math.PI * 2
          const l = i % 9 === 0 ? 7 : 3
          return <line key={i} x1={r2(Math.cos(a) * R)} y1={r2(Math.sin(a) * R)} x2={r2(Math.cos(a) * (R - l))} y2={r2(Math.sin(a) * (R - l))} className="radar__tick" />
        })}
        <g clipPath="url(#radar-clip)">
          <path d={`M0 0 L${R} 0 A${R} ${R} 0 0 0 ${r2(R * Math.cos(-0.7))} ${r2(R * Math.sin(-0.7))} Z`} fill="url(#radar-sweep)" className="radar__sweep" />
          {venueScale ? (
            <g>
              <rect x={r2(HALL.min[0] * VENUE_SCALE)} y={r2(HALL.min[1] * VENUE_SCALE)} width={r2(hallW)} height={r2(hallH)} className="radar__hall" />
              {meta?.walls.map((w, i) => (
                <line key={i} x1={r2(w[0] * VENUE_SCALE)} y1={r2(w[1] * VENUE_SCALE)} x2={r2(w[2] * VENUE_SCALE)} y2={r2(w[3] * VENUE_SCALE)} className="radar__wall" />
              ))}
              {ZONES.map((z) => {
                const hot = filtered ? f.zoneHeat[ZONES.indexOf(z)] : 0
                const on = z.id === selectedZone || (nav.kind === 'zone' && nav.id === z.id)
                return (
                  <rect
                    key={z.id}
                    x={r2(z.rect[0] * VENUE_SCALE)}
                    y={r2(z.rect[1] * VENUE_SCALE)}
                    width={r2((z.rect[2] - z.rect[0]) * VENUE_SCALE)}
                    height={r2((z.rect[3] - z.rect[1]) * VENUE_SCALE)}
                    className={`radar__zone${on ? ' is-on' : ''}`}
                    style={{ ['--accent' as string]: z.accent, ['--heat' as string]: hot }}
                  />
                )
              })}
              {EVENTS.map((e) => {
                const a = EVENT_ANCHORS.get(e.slug)!
                const on = !filtered || f.events.has(e.slug)
                return <circle key={e.slug} cx={r2(a.x * VENUE_SCALE)} cy={r2(a.z * VENUE_SCALE)} r={on ? 1.8 : 1} className="radar__ev" style={{ ['--accent' as string]: CATEGORIES.find((c) => c.id === e.category)?.accent, opacity: on ? 1 : 0.25 }} />
              })}
            </g>
          ) : (
            <g>
              {PLANETS.map((p) => {
                const [cx, , cz] = planetPos(p)
                const c = { x: cx, z: cz }
                const d = Math.hypot(c.x, c.z)
                const r = sysR(d)
                const on = nav.kind === 'planet' && nav.id === p.id
                return (
                  <g key={p.id}>
                    <circle r={r2(r)} className="radar__orbit" />
                    <circle cx={r2((c.x / d) * r)} cy={r2((c.z / d) * r)} r={on ? 5 : 3.4} className={`radar__planet${on ? ' is-on' : ''}${filtered && !f.planets.has(p.id) ? ' is-dim' : ''}`} style={{ ['--accent' as string]: p.accent }} />
                  </g>
                )
              })}
              <rect x={-4} y={-2} width={8} height={4} className="radar__station" />
            </g>
          )}
          {dest && <line ref={bearing} x2={r2(dest[0])} y2={r2(dest[1])} className="radar__bearing" />}
          {dest && <circle cx={r2(dest[0])} cy={r2(dest[1])} r={5} className="radar__dest" />}
          <g ref={you}>
            <path d="M0 -7 L4 4 L0 2 L-4 4 Z" className="radar__you" />
            <path d="M0 0 L-16 -34 A37 37 0 0 1 16 -34 Z" className="radar__fov" />
          </g>
        </g>
        <circle r={R} className="radar__rim" />
      </svg>
      <p className="radar__caption mono">
        <span>{venueScale ? 'Venue' : 'System'}</span>
        <span ref={readout} className="dust" />
      </p>
      {/* accessible quick targets */}
      <div className="sr-only">
        {venueScale
          ? ZONES.map((z) => (
              <button key={z.id} type="button" onClick={() => go(mode === 'explore' ? { nav: { kind: 'zone', id: z.id }, selectedZone: z.id } : { selectedZone: z.id })}>
                {z.code} {z.name}
              </button>
            ))
          : PLANETS.map((p) => (
              <button key={p.id} type="button" onClick={() => go({ nav: { kind: 'planet', id: p.id } })}>
                {p.name}
              </button>
            ))}
      </div>
    </div>
  )
}
