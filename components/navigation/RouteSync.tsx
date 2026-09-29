'use client'
import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useWorld, type Mode } from '@/lib/store'
import { arrive, registerNavigate } from '@/lib/jump'
import { lenis } from '@/components/motion/SmoothScroll'

/** The URL is the source of truth for where the camera is. */
export function modeFor(path: string): Mode {
  if (path === '/') return 'home'
  if (path.startsWith('/explore')) return 'explore'
  if (path.startsWith('/venue')) return 'venue'
  if (path.startsWith('/competitions')) return 'competitions'
  if (path.startsWith('/events')) return 'events'
  if (path.startsWith('/schedule')) return 'schedule'
  if (path.startsWith('/artists')) return 'artists'
  if (path.startsWith('/register')) return 'register'
  return 'page'
}

export function RouteSync() {
  const pathname = usePathname()
  const router = useRouter()
  const first = useRef(true)

  useEffect(() => {
    registerNavigate((href) => router.push(href, { scroll: true }))
  }, [router])

  useEffect(() => {
    const mode = modeFor(pathname)
    const st = useWorld.getState()
    // explore can be deep-linked: /explore?to=planet:sonic | zone:supergiant | event:slug | system
    let nav = st.nav
    if (mode === 'explore') {
      const to = new URLSearchParams(window.location.search).get('to') ?? 'system'
      const [kind, id] = to.split(':')
      nav = (['planet', 'zone', 'event'].includes(kind) && id ? { kind, id } : ['space', 'galaxy', 'system', 'venue'].includes(kind) ? { kind } : { kind: 'system' }) as typeof nav
    } else if (mode === 'venue') nav = { kind: 'venue' }
    st.set({
      mode,
      nav,
      filterOpen: false,
      selectedEvent: mode === 'explore' && nav.kind === 'event' ? nav.id : null,
      hoveredPlanet: null,
      hoveredConstellation: null,
      navOpen: false,
      hoveredZone: null,
      hoveredCategory: null,
      hoveredEvent: null,
      selectedZone: mode === 'venue' || mode === 'explore' ? st.selectedZone : null,
      selectedCategory: mode === 'events' || mode === 'competitions' ? st.selectedCategory : null,
      // the cold open belongs to the front door only
      introDone: mode === 'home' ? st.introDone : true,
    })
    lenis?.scrollTo(0, { immediate: true })
    window.scrollTo(0, 0)
    // a route change without a jump in flight is history navigation (back / forward)
    arrive(pathname, !first.current)
    first.current = false
  }, [pathname])

  return null
}
