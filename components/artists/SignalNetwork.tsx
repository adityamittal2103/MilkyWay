'use client'
import { useEffect, useRef, useState } from 'react'
import type { Artist } from '@/data/artists'
import { categoryById } from '@/data/categories'
import { zoneById } from '@/data/zones'
import { PROVISIONAL_DAYS } from '@/data/provisional/events'
import { SyntheticSignal } from '@/lib/transmission/signal'
import { TransitionLink } from '@/components/navigation/TransitionLink'
import { audio } from '@/lib/audio'

/**
 * TRANSMISSIONS as a signal network, not a list. Each artist is a node in a field; faint carrier
 * lines connect them. Every node carries its own live (synthetic, silent) waveform:
 *   rest  → a low murmur        hover/focus → the signal gets louder, the node grows,
 *   tiny transmission metadata appears       click → enter the transmission (decode the face)
 * Positions are authored (constellation-like), not a grid; on narrow screens the field stacks.
 */
const LAYOUT: [number, number][] = [
  [0.2, 0.34],
  [0.58, 0.2],
  [0.8, 0.58],
  [0.38, 0.72],
  [0.12, 0.8],
  [0.66, 0.86],
]
const pad = (n: number) => String(n).padStart(3, '0')

export function SignalNetwork({ artists }: { artists: Artist[] }) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [hot, setHot] = useState<string | null>(null)
  const hotRef = useRef<string | null>(null)
  hotRef.current = hot

  useEffect(() => {
    const cv = canvas.current
    const el = wrap.current
    if (!cv || !el) return
    const g = cv.getContext('2d')!
    const sigs = artists.map((a) => new SyntheticSignal(a.transmissionSeed, a.genre, 'normal'))
    const gain = artists.map(() => 0.25)
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    let last = t0
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = (now - t0) / 1000
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = el.clientWidth
      const H = el.clientHeight
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr)
        cv.height = Math.round(H * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, W, H)
      const nodes = [...el.querySelectorAll<HTMLElement>('[data-node]')]
      const pts = nodes.map((n) => {
        const r = n.getBoundingClientRect()
        const o = el.getBoundingClientRect()
        const dot = n.querySelector<HTMLElement>('.sn-node__dot')!.getBoundingClientRect()
        return { x: dot.left + dot.width / 2 - o.left, y: dot.top + dot.height / 2 - o.top, w: r.width }
      })
      // carrier lines between neighbouring nodes, with a pulse travelling along each
      g.lineWidth = 1
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const lit = hotRef.current === artists[i].id || hotRef.current === artists[i + 1].id ? 1 : 0
        g.strokeStyle = `rgba(207,224,255,${0.08 + lit * 0.14})`
        g.beginPath()
        g.moveTo(a.x, a.y)
        g.lineTo(b.x, b.y)
        g.stroke()
        const ph = rm ? 0.5 : (t * 0.18 + i * 0.37) % 1
        g.fillStyle = `rgba(255,244,224,${0.5 + lit * 0.4})`
        g.beginPath()
        g.arc(a.x + (b.x - a.x) * ph, a.y + (b.y - a.y) * ph, 1.6, 0, Math.PI * 2)
        g.fill()
      }
      // each node's own waveform, louder when it is the one you are reaching for
      artists.forEach((a, i) => {
        const p = pts[i]
        if (!p) return
        const on = hotRef.current === a.id
        gain[i] += ((on ? 1 : 0.22) - gain[i]) * Math.min(1, dt * 8)
        const f = sigs[i].update(rm ? 1 : t + i * 3.1, dt)
        const len = 90 + gain[i] * 70
        g.strokeStyle = a.colour[on ? 1 : 0]
        g.globalAlpha = 0.35 + gain[i] * 0.6
        g.lineWidth = 1.2 + gain[i]
        g.beginPath()
        for (let k = 0; k <= 64; k++) {
          const x = p.x - len / 2 + (k / 64) * len
          const env = Math.sin((k / 64) * Math.PI)
          const y = p.y + f.wave[Math.floor((k / 64) * 255)] * (4 + gain[i] * 16) * env
          if (k) g.lineTo(x, y)
          else g.moveTo(x, y)
        }
        g.stroke()
        g.globalAlpha = 1
      })
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [artists])

  return (
    <div className="sn" ref={wrap}>
      <canvas ref={canvas} className="sn__canvas" aria-hidden="true" />
      <ol className="sn__field">
        {artists.map((a, i) => {
          const [x, y] = LAYOUT[i % LAYOUT.length]
          const n = parseInt(a.id.replace(/\D/g, ''), 10) || i + 1
          const zone = zoneById(a.venue)
          const day = a.day != null ? PROVISIONAL_DAYS[a.day] : null
          const on = hot === a.id
          return (
            <li key={a.id} className={`sn-node${on ? ' is-on' : ''}`} style={{ ['--x' as string]: x, ['--y' as string]: y, ['--c1' as string]: a.colour[0], ['--c2' as string]: a.colour[1] }} data-node>
              <TransitionLink
                href={`/artists/${a.id}`}
                label={`Transmission ${pad(n)}`}
                className="sn-node__link"
                cursor="transmission"
                data-cursor-label="DECODE"
                onMouseEnter={() => {
                  setHot(a.id)
                  audio.ping(1.1 + i * 0.05)
                }}
                onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(a.id)}
                onBlur={() => setHot(null)}
                aria-label={`${a.provisional ? 'Test transmission' : 'Transmission'} ${pad(n)}: ${a.name}, ${categoryById(a.genre)?.name ?? a.genre}${day ? `, ${day.label}` : ''}${a.time ? ` ${a.time}` : ''}. Decode.`}
              >
                <span className="sn-node__dot" aria-hidden="true" />
                <span className="sn-node__code mono">TX-{pad(n)}</span>
                <span className="sn-node__name">{a.name}</span>
                <span className="sn-node__meta mono" aria-hidden="true">
                  {categoryById(a.genre)?.name ?? a.genre} · {day?.label ?? 'TBA'} {a.time ?? ''} · {zone?.code}
                  <br />
                  seed {a.transmissionSeed.toString(16).toUpperCase()} · {a.audio ? a.audioKind ?? 'audio' : 'synthetic'} · click to decode
                </span>
              </TransitionLink>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
