'use client'
import { useEffect, useState } from 'react'
import { HALL } from '@/lib/constants'
import { ZONES } from '@/data/zones'
import { useWorld } from '@/lib/store'

type Meta = { walls: number[][]; floorMarks: number[][] }

/**
 * The same floor plan as a 2D star chart (SVG). Used as the minimap on the venue page and as
 * the full, clickable map when WebGL is unavailable, so nothing depends on the 3D world.
 */
export function VenuePlan({ interactive = false, className = '' }: { interactive?: boolean; className?: string }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const hovered = useWorld((s) => s.hoveredZone)
  const selected = useWorld((s) => s.selectedZone)
  useEffect(() => {
    fetch('/data/venue-meta.json')
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {})
  }, [])
  const pad = 14
  const x0 = HALL.min[0] - pad
  const z0 = HALL.min[1] - pad - 90 // include the outside kiosk to the north
  const w = HALL.max[0] - HALL.min[0] + pad * 2
  const h = HALL.max[1] - HALL.min[1] + pad * 2 + 90
  return (
    <svg className={`plan ${className}`} viewBox={`${x0} ${z0} ${w} ${h}`} role={interactive ? 'group' : 'img'} aria-label="Floor plan of the hall at Yashobhoomi with festival sectors">
      <rect x={HALL.min[0]} y={HALL.min[1]} width={HALL.max[0] - HALL.min[0]} height={HALL.max[1] - HALL.min[1]} className="plan__hall" />
      {ZONES.map((z) => {
        const on = z.id === hovered || z.id === selected
        const r = (
          <rect
            key={z.id}
            x={z.rect[0]}
            y={z.rect[1]}
            width={z.rect[2] - z.rect[0]}
            height={z.rect[3] - z.rect[1]}
            className={`plan__zone${on ? ' is-on' : ''}`}
            style={{ ['--accent' as string]: z.accent }}
          />
        )
        if (!interactive) return r
        return (
          <g
            key={z.id}
            role="button"
            tabIndex={0}
            aria-label={`${z.code} ${z.name}: ${z.use}`}
            aria-pressed={z.id === selected}
            onClick={() => useWorld.getState().set({ selectedZone: z.id === selected ? null : z.id })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                useWorld.getState().set({ selectedZone: z.id === selected ? null : z.id })
              }
            }}
            onMouseEnter={() => useWorld.getState().set({ hoveredZone: z.id })}
            onMouseLeave={() => useWorld.getState().set({ hoveredZone: null })}
            data-cursor="target"
          >
            {r}
            <text x={(z.rect[0] + z.rect[2]) / 2} y={(z.rect[1] + z.rect[3]) / 2} className="plan__label">
              {z.code}
            </text>
          </g>
        )
      })}
      {meta?.walls.map((s, i) => <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} className="plan__wall" />)}
    </svg>
  )
}
