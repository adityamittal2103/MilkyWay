import type { ZoneGlyph } from '@/data/zones'

/** Sector marks: every glyph is built from the same orbital primitives (ring, arc, tick, dot). */
const r2 = (n: number) => Math.round(n * 100) / 100

export function SectorGlyph({ glyph, size = 40, color = 'currentColor' }: { glyph: ZoneGlyph; size?: number; color?: string }) {
  const c = 20
  const parts: React.ReactNode[] = []
  if (glyph.ring) parts.push(<circle key="r" cx={c} cy={c} r={15} fill="none" stroke={color} strokeWidth={1} />)
  for (let i = 0; i < glyph.arcs; i++) {
    const r = 9 + i * 3.5
    const a0 = glyph.rot + i * 1.9
    const a1 = a0 + 2.2
    const p0 = [c + r * Math.cos(a0), c + r * Math.sin(a0)]
    const p1 = [c + r * Math.cos(a1), c + r * Math.sin(a1)]
    parts.push(<path key={`a${i}`} d={`M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${r} ${r} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`} fill="none" stroke={color} strokeWidth={1.4} />)
  }
  for (let i = 0; i < glyph.ticks; i++) {
    const a = glyph.rot + (i / glyph.ticks) * Math.PI * 2
    parts.push(
      <line key={`t${i}`} x1={r2(c + 16.5 * Math.cos(a))} y1={r2(c + 16.5 * Math.sin(a))} x2={r2(c + 19.5 * Math.cos(a))} y2={r2(c + 19.5 * Math.sin(a))} stroke={color} strokeWidth={1} />,
    )
  }
  if (glyph.dot === 'center') parts.push(<circle key="d" cx={c} cy={c} r={2.6} fill={color} />)
  if (glyph.dot === 'orbit') parts.push(<circle key="d" cx={r2(c + 12 * Math.cos(glyph.rot + 0.8))} cy={r2(c + 12 * Math.sin(glyph.rot + 0.8))} r={2.2} fill={color} />)
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {parts}
    </svg>
  )
}
