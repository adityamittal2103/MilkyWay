import { ImageResponse } from 'next/og'
import { FESTIVAL } from '@/data/festival'

export const alt = `${FESTIVAL.name}: ${FESTIVAL.organiser} ${FESTIVAL.descriptor}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** A share card set like a star-chart plate: deterministic stars, the insignia, the wordmark. */
export default function OG() {
  let s = 7
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const stars = Array.from({ length: 140 }, () => ({ x: rnd() * 1200, y: rnd() * 630, r: rnd() < 0.08 ? 2.4 : 1 + rnd() }))
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#030409', color: '#F1EDE4', position: 'relative', fontFamily: 'sans-serif' }}>
        {stars.map((p, i) => (
          <div key={i} style={{ position: 'absolute', left: p.x, top: p.y, width: p.r, height: p.r, borderRadius: 9, background: i % 17 === 0 ? '#FF7A1A' : '#CFE0FF', opacity: 0.8 }} />
        ))}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 360, height: 1, background: 'rgba(241,237,228,0.25)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 72px', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase', color: '#8B90A6' }}>
            {FESTIVAL.organiser} · {FESTIVAL.descriptor}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 188, fontWeight: 900, lineHeight: 0.82, letterSpacing: -6 }}>MILKY WAY</div>
            <div style={{ display: 'flex', gap: 28, marginTop: 28, fontSize: 26, letterSpacing: 3, textTransform: 'uppercase' }}>
              <span>Theme · {FESTIVAL.theme}</span>
              <span style={{ color: '#FF7A1A' }}>●</span>
              <span>
                {FESTIVAL.venue.name}, {FESTIVAL.venue.city}
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  )
}
