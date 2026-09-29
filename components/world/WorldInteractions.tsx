'use client'
import { useEffect } from 'react'
import { live, useWorld } from '@/lib/store'
import { audio } from '@/lib/audio'
import { jump } from '@/lib/jump'
import { zoneAt, zoneById } from '@/data/zones'
import { eventBySlug } from '@/data/provisional/events'
import { planetById } from '@/data/planets'
import { SECTION_SKY } from '@/lib/sectionSky'
import { EVENT_ANCHORS } from '@/lib/director'
import { planetPosition } from '@/lib/universe'

const UI_SELECTOR = '[data-ui], a, button, input, textarea, select, label, summary, [role="button"], [role="dialog"]'

/**
 * A click on the world means different things depending on what is under the reticle.
 * Every click gets feedback: an energy pulse where it landed, a tone if sound is on.
 */
export function worldClick() {
  const s = useWorld.getState()
  const pulse = (x: number, y: number, z: number, color: string) => Object.assign(live.pulse, { x, y, z, t: live.clock, color })
  const kind = live.hoverKind

  if (kind === 'constellation' && s.hoveredConstellation) {
    const sec = SECTION_SKY.find((x) => x.id === s.hoveredConstellation)!
    pulse(sec.centre.x, sec.centre.y, sec.centre.z, '#CFE0FF')
    audio.engage()
    jump(sec.href, sec.label)
    return
  }
  if (kind === 'planet' && s.hoveredPlanet) {
    const p = planetById(s.hoveredPlanet)!
    const c = planetPosition(p)
    pulse(c.x, c.y, c.z, p.accent)
    s.discover(`planet:${p.id}`)
    if (s.mode === 'explore') s.set({ nav: { kind: 'planet', id: p.id } })
    else jump(`/explore?to=planet:${p.id}`, `${p.name} · ${p.group}`)
    return
  }
  if (s.mode === 'explore' || s.mode === 'venue') {
    if (kind === 'event' && s.hoveredEvent) {
      const a = EVENT_ANCHORS.get(s.hoveredEvent)!
      const ev = eventBySlug(s.hoveredEvent)!
      pulse(a.x, 0.5, a.z, '#F1EDE4')
      s.discover(`event:${ev.slug}`)
      s.set({ selectedEvent: ev.slug, selectedZone: ev.zone, ...(s.mode === 'explore' ? { nav: { kind: 'event', id: ev.slug } as const } : {}) })
      audio.engage()
      return
    }
    const id = s.coarse ? (zoneAt(live.floor.x, live.floor.z)?.id ?? null) : s.hoveredZone
    if (id) {
      pulse(live.floor.x, 0.5, live.floor.z, zoneById(id)!.accent)
      s.discover(`zone:${id}`)
      if (s.mode === 'explore') s.set({ nav: { kind: 'zone', id }, selectedZone: id, selectedEvent: null })
      else s.set({ selectedZone: s.selectedZone === id ? null : id, selectedEvent: null })
      audio.ping(1.2)
    }
    return
  }
  if (s.mode === 'events' || s.mode === 'competitions') {
    if (s.hoveredCategory) {
      s.set({ selectedCategory: s.selectedCategory === s.hoveredCategory ? null : s.hoveredCategory })
      audio.ping(1.1)
    }
    return
  }
  if (s.mode === 'schedule' && s.hoveredEvent) {
    const ev = eventBySlug(s.hoveredEvent)
    if (ev) {
      // selecting a schedule item focuses its sector in the hall below the orbits
      s.set({ selectedEvent: ev.slug, selectedZone: ev.zone })
      audio.engage()
    }
  }
}


/** Mounted inside the (lazy) world: clicks on empty space become world interactions. */
export function WorldInteractions() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.(UI_SELECTOR)) return
      if (live.orbit.dragging) return
      // on touch there is no hover: resolve what's under the tap on the next frame
      requestAnimationFrame(() => requestAnimationFrame(worldClick))
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])
  return null
}
