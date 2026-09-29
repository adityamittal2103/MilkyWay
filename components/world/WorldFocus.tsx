'use client'
import { useEffect } from 'react'
import { useWorld } from '@/lib/store'

/** Lets a server-rendered page point the camera at something (a sector, a constellation). */
export function WorldFocus({ zone, category, event }: { zone?: string | null; category?: string | null; event?: string | null }) {
  useEffect(() => {
    const p: Record<string, string | null> = {}
    if (zone !== undefined) p.selectedZone = zone
    if (category !== undefined) p.selectedCategory = category
    if (event !== undefined) p.selectedEvent = event
    // after RouteSync has applied the route's defaults
    const t = setTimeout(() => useWorld.getState().set(p), 0)
    return () => clearTimeout(t)
  }, [zone, category, event])
  return null
}
