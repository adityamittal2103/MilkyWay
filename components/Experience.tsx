'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { detectCapabilities } from '@/lib/quality'
import { initDebug, stats, useDebug } from '@/lib/debug'
import { live, useWorld } from '@/lib/store'
import { audio } from '@/lib/audio'
import { TopBar } from './navigation/TopBar'
import { NavOverlay } from './navigation/NavOverlay'
import { JumpOverlay } from './navigation/JumpOverlay'
import { RouteSync } from './navigation/RouteSync'
import { Cursor } from './ui/Cursor'
import { Loader } from './ui/Loader'
import { LorePanel } from './ui/LorePanel'
import { FilterDial } from './filter/FilterDial'
import { SmoothScroll } from './motion/SmoothScroll'
import { Intro } from './motion/Intro'
import { NavInput } from './world/NavInput'

// The 3D world is client-only and code-split: text and navigation never wait for three.js.
const WorldCanvas = dynamic(() => import('./world/WorldCanvas'), { ssr: false })
const WorldLabels = dynamic(() => import('./world/Labels').then((m) => m.WorldLabels), { ssr: false })
// flicker diagnostics: its own chunk, only fetched with ?debug
const DebugPanel = dynamic(() => import('./debug/DebugPanel'), { ssr: false })

const UI_SELECTOR = '[data-ui], a, button, input, textarea, select, label, summary, [role="button"], [role="dialog"]'

/** Persistent shell: one world, one camera, across every route. */
export function Experience() {
  const webgl = useWorld((s) => s.webgl)
  const debug = useDebug((s) => s.enabled)
  const [caps, setCaps] = useState(false)
  const [mount, setMount] = useState(false)

  useEffect(() => {
    const qa = new URLSearchParams(location.search).has('qa')
    const dbgOn = initDebug()
    if (process.env.NODE_ENV !== 'production' || qa || dbgOn) (window as unknown as { __mw: unknown }).__mw = { live, useWorld, useDebug, stats }
    const c = detectCapabilities()
    useWorld.getState().set(c)
    setCaps(true)
    if (c.webgl) {
      // network first (assets stream while the page settles), then the 3D engine after first paint
      import('@/lib/venueData').then((m) => m.preloadVenue()).catch(() => {})
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
      if (w.requestIdleCallback) w.requestIdleCallback(() => setMount(true), { timeout: 700 })
      else setTimeout(() => setMount(true), 200)
    }
    try {
      const d = JSON.parse(localStorage.getItem('mw-discovered') ?? '[]')
      if (Array.isArray(d)) useWorld.getState().set({ discovered: d.filter((x) => typeof x === 'string') })
      const f = sessionStorage.getItem('mw-filter')
      if (f) useWorld.getState().set({ filter: f })
      if (localStorage.getItem('mw-sound') === '1') {
        // browsers require a gesture: arm on the first interaction
        const arm = () => {
          useWorld.getState().set({ sound: true })
          audio.start()
          window.removeEventListener('pointerdown', arm)
          window.removeEventListener('keydown', arm)
        }
        window.addEventListener('pointerdown', arm, { once: true })
        window.addEventListener('keydown', arm, { once: true })
      }
    } catch {}

    const onMove = (e: PointerEvent) => {
      const p = live.pointer
      p.px = e.clientX
      p.py = e.clientY
      p.x = (e.clientX / window.innerWidth) * 2 - 1
      p.y = -(e.clientY / window.innerHeight) * 2 + 1
      p.active = true
      p.overWorld = !(e.target as Element)?.closest?.(UI_SELECTOR)
    }
    const onLeave = () => {
      live.pointer.active = false
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    // audible feedback for world hovers (only when sound is on); the filter persists per session
    const unsub = useWorld.subscribe((s, prev) => {
      if (s.hoveredZone && s.hoveredZone !== prev.hoveredZone) audio.ping(0.9)
      if (s.hoveredCategory && s.hoveredCategory !== prev.hoveredCategory) audio.ping(1.05)
      if (s.hoveredEvent && s.hoveredEvent !== prev.hoveredEvent) audio.ping(1.25)
      if (s.hoveredPlanet && s.hoveredPlanet !== prev.hoveredPlanet) audio.ping(0.7)
      if (s.hoveredConstellation && s.hoveredConstellation !== prev.hoveredConstellation) audio.ping(1.4)
      if (s.filter !== prev.filter) {
        try {
          sessionStorage.setItem('mw-filter', s.filter)
        } catch {}
      }
    })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      document.removeEventListener('pointerleave', onLeave)
      unsub()
    }
  }, [])

  return (
    <>
      <div className={`world${caps && !webgl ? ' world--static' : ''}`} aria-hidden="true">
        {caps && webgl && mount && <WorldCanvas />}
      </div>
      {caps && webgl && mount && <WorldLabels />}
      <div className="world-veil" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <RouteSync />
      <SmoothScroll />
      <NavInput />
      <TopBar />
      <NavOverlay />
      <FilterDial />
      <JumpOverlay />
      <LorePanel />
      <Intro />
      <Cursor />
      <Loader />
      {debug && <DebugPanel />}
    </>
  )
}

