'use client'
import { useEffect, useRef } from 'react'
import { live, useWorld } from '@/lib/store'

/**
 * THE RETICLE SYSTEM: one targeting language across DOM and world.
 *   default      → a small star                    hover/planet → orbital ring
 *   target       → reticle (controls)              event        → targeting reticle, rotating
 *   enter        → ring + label                    zone         → target brackets (sectors)
 *   ship         → cockpit indicator (JUGAAD-1)    star         → constellation lock
 *   move         → directional indicator: points where you are flying (W/A/S/D/Q/E)
 *   transmission → a live waveform (signals, decoding)
 *   destination  → navigation marker (fly / view)  register, pulse → boarding lock (the Board action)
 *   text         → caret over form fields
 * DOM elements set it with data-cursor; the 3D world sets live.hoverKind every frame.
 * States cross-fade (ring size/shape/colour are transitions, never swaps). Fine pointers only.
 */
const WORLD_STATE: Record<string, string> = { zone: 'zone', planet: 'planet', event: 'event', ship: 'ship', constellation: 'star', star: 'star', transmission: 'transmission' }
const TRAIL = 14

export function Cursor() {
  const root = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const line = useRef<SVGPolylineElement>(null)

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    document.documentElement.classList.add('has-cursor')
    const pos = { x: -100, y: -100 }
    const ringPos = { x: -100, y: -100 }
    const pts: { x: number; y: number }[] = Array.from({ length: TRAIL }, () => ({ x: -100, y: -100 }))
    let state = 'default'
    let domState = 'default'
    let domLabel = ''
    let raf = 0

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX
      pos.y = e.clientY
      const el = (e.target as HTMLElement)?.closest?.('[data-cursor], a, button, input, textarea, select, summary, [role="button"]') as HTMLElement | null
      if (!el) {
        domState = 'default'
        domLabel = ''
      } else if (el.dataset.cursor) {
        domState = el.dataset.cursor
        domLabel = el.dataset.cursorLabel ?? (domState === 'enter' ? 'ENTER' : domState === 'pulse' ? 'BOARD' : '')
      } else if (/INPUT|TEXTAREA/.test(el.tagName)) {
        domState = 'text'
        domLabel = ''
      } else {
        domState = 'target'
        domLabel = ''
      }
    }
    const onLeave = () => {
      pos.x = pos.y = -100
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    const loop = () => {
      raf = requestAnimationFrame(loop)
      const st = useWorld.getState()
      let next = domState
      let text = domLabel
      if (domState === 'default' && live.pointer.overWorld) {
        if (live.hoverKind) {
          next = WORLD_STATE[live.hoverKind] ?? 'gravity'
          text = live.hoverLabel.toUpperCase()
        } else if (st.hoveredCategory && (st.mode === 'events' || st.mode === 'competitions')) {
          next = 'star'
          text = 'OPEN'
        } else if (live.orbit.dragging) next = 'drag'
        else if ((live.camState === 'user' || live.camState === 'idle') && live.pilot.speed > 0.08) {
          // piloting: the cursor becomes the heading indicator (up = forward, right = strafe right)
          next = 'move'
          text = live.input.boost ? 'BOOST' : ''
          const ang = Math.atan2(live.pilot.r, live.pilot.f - live.pilot.u * 0.5)
          root.current?.style.setProperty('--dir', `${ang.toFixed(3)}rad`)
        }
      }
      if (next !== state || (label.current && label.current.textContent !== text)) {
        state = next
        root.current?.setAttribute('data-state', state)
        if (label.current) label.current.textContent = text
      }
      ringPos.x += (pos.x - ringPos.x) * 0.2
      ringPos.y += (pos.y - ringPos.y) * 0.2
      if (root.current) root.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${ringPos.x - pos.x}px, ${ringPos.y - pos.y}px, 0)`
      pts.pop()
      pts.unshift({ x: pos.x, y: pos.y })
      if (line.current) line.current.setAttribute('points', pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '))
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <svg className="cursor__trail" aria-hidden="true">
        <defs>
          <linearGradient id="trail-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100%" y2="0">
            <stop offset="0" stopColor="#CFE0FF" stopOpacity="0.5" />
            <stop offset="1" stopColor="#5B8CFF" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <polyline ref={line} />
      </svg>
      <div ref={root} className="cursor" data-state="default" aria-hidden="true">
        <div ref={ring} className="cursor__ring" />
        <div className="cursor__dot" />
        <span className="cursor__glyph" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
        <span ref={label} className="cursor__label" />
      </div>
    </>
  )
}
