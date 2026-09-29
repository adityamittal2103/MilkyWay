'use client'
import { useEffect, useRef } from 'react'
import type { Artist } from '@/data/artists'
import { loadPortrait } from '@/lib/transmission/portrait'

/**
 * Without WebGL the transmission still resolves: the same portrait data drawn once in 2D as
 * scanline strands (each row of the face as a line of light), in the artist's colours.
 */
export function StaticPortrait({ artist }: { artist: Artist }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let alive = true
    loadPortrait(artist.image!, artist.imageKind ?? 'photo', 9000, artist.transmissionSeed).then((c) => {
      const cv = ref.current
      if (!alive || !cv) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = cv.clientWidth * dpr
      const H = cv.clientHeight * dpr
      cv.width = W
      cv.height = H
      const g = cv.getContext('2d')!
      g.globalCompositeOperation = 'lighter'
      const s = (H / 2.2) * 0.98
      for (let i = 0; i < c.n; i++) {
        const x = W / 2 + c.pos[i * 3] * s
        const y = H / 2 - c.pos[i * 3 + 1] * s
        const l = c.attr[i * 4]
        const row = c.attr[i * 4 + 2]
        g.fillStyle = row < 0.5 ? artist.colour[0] : artist.colour[1]
        g.globalAlpha = 0.12 + l * 0.7
        g.fillRect(x, y, 1.6 * dpr, 1.6 * dpr)
      }
    })
    return () => {
      alive = false
    }
  }, [artist])
  return <canvas ref={ref} className="tx-static" role="img" aria-label={`${artist.name}: portrait reconstructed from the transmission`} />
}
