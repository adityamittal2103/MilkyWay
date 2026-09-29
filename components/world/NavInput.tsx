'use client'
import { useEffect } from 'react'
import { live, useWorld, type NavTarget } from '@/lib/store'
import { audio } from '@/lib/audio'

/**
 * Pilot INPUT for the navigable modes (explore + venue). DOM listeners only: this file never
 * touches the camera. It records intent in `live.input` / `live.orbit`; the CameraRig is the one
 * camera authority and turns intent into motion (acceleration, damping, bounds).
 *
 *   W / ↑  forward        S / ↓  backward        A / ←  strafe left     D / →  strafe right
 *   E      up             Q      down            Shift  boost           + / −  zoom
 *   R      return to the exploration orientation                       Esc    back out one level
 *   drag   orbit          wheel / pinch  zoom    right-drag / two-finger drag  move
 *
 * Stuck keys are impossible by construction: every path that can swallow a keyup (window blur,
 * tab hidden, focus entering a form field, ⌘ held on macOS, leaving the navigable mode) clears
 * the held set.
 */
export function parentOf(n: NavTarget): NavTarget | null {
  switch (n.kind) {
    case 'event':
      return { kind: 'venue' }
    case 'zone':
      return { kind: 'venue' }
    case 'venue':
      return { kind: 'system' }
    case 'planet':
      return { kind: 'system' }
    case 'system':
      return { kind: 'galaxy' }
    case 'galaxy':
      return { kind: 'space' }
    default:
      return null
  }
}

const MOVE: Record<string, [axis: 'f' | 'r' | 'u' | 'zoom', sign: number]> = {
  KeyW: ['f', 1],
  ArrowUp: ['f', 1],
  KeyS: ['f', -1],
  ArrowDown: ['f', -1],
  KeyD: ['r', 1],
  ArrowRight: ['r', 1],
  KeyA: ['r', -1],
  ArrowLeft: ['r', -1],
  KeyE: ['u', 1],
  KeyQ: ['u', -1],
  Equal: ['zoom', -1],
  NumpadAdd: ['zoom', -1],
  Minus: ['zoom', 1],
  NumpadSubtract: ['zoom', 1],
}

const UI_SELECTOR = '[data-ui], a, button, input, textarea, select, label, summary, [role="button"], [role="dialog"]'

const isField = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable)
}

export function NavInput() {
  useEffect(() => {
    const o = live.orbit
    const inp = live.input
    const pointers = new Map<number, { x: number; y: number; button: number }>()
    let startX = 0
    let startY = 0
    let pinch = 0
    let centroid: { x: number; y: number } | null = null
    const keys = new Set<string>()

    const active = () => {
      const m = useWorld.getState().mode
      return m === 'explore' || m === 'venue'
    }
    // autopilot holds the controls: a flight is never fought by the user's input
    const piloting = () => active() && live.camState !== 'flight'

    const recompute = () => {
      inp.f = inp.r = inp.u = inp.zoom = 0
      for (const k of keys) {
        const m = MOVE[k]
        if (m) inp[m[0]] += m[1]
      }
      // opposite keys cancel; each axis stays in −1…1 (the rig normalises the combined vector)
      inp.f = Math.max(-1, Math.min(1, inp.f))
      inp.r = Math.max(-1, Math.min(1, inp.r))
      inp.u = Math.max(-1, Math.min(1, inp.u))
      inp.zoom = Math.max(-1, Math.min(1, inp.zoom))
      inp.boost = keys.has('ShiftLeft') || keys.has('ShiftRight')
      inp.last = performance.now()
    }
    const releaseAll = () => {
      if (!keys.size && !inp.f && !inp.r && !inp.u && !inp.zoom) return
      keys.clear()
      recompute()
    }

    const keydown = (e: KeyboardEvent) => {
      if (!active()) return
      if (isField(e.target)) return
      // shortcuts (⌘/Ctrl/Alt) belong to the browser; on macOS ⌘ also swallows keyups
      if (e.metaKey || e.ctrlKey || e.altKey) {
        releaseAll()
        return
      }
      const st = useWorld.getState()
      if (st.filterOpen || st.navOpen) return
      if (e.key === 'Escape') {
        if (st.mode === 'venue') {
          if (st.selectedEvent) st.set({ selectedEvent: null })
          else if (st.selectedZone) st.set({ selectedZone: null })
          return
        }
        const p = parentOf(st.nav)
        if (p) {
          st.set({ nav: p, selectedEvent: null, selectedZone: p.kind === 'venue' ? null : st.selectedZone })
          audio.ping(0.8)
        }
        return
      }
      const k = e.code
      if (k === 'KeyR') {
        if (!e.repeat) inp.reset++
        e.preventDefault()
        return
      }
      if (MOVE[k] || k === 'ShiftLeft' || k === 'ShiftRight') {
        // arrows scroll/move focus inside panels: only steal them when focus is on the page itself
        if (k.startsWith('Arrow') && e.target && e.target !== document.body) return
        e.preventDefault()
        if (!keys.has(k)) {
          keys.add(k)
          recompute()
        }
      }
    }
    const keyup = (e: KeyboardEvent) => {
      // always honoured, wherever focus is: a released key must never keep the ship moving
      if (e.key === 'Meta') return releaseAll()
      if (keys.delete(e.code)) recompute()
    }
    const onBlur = () => releaseAll()
    const onVis = () => {
      if (document.hidden) {
        releaseAll()
        pointers.clear()
        o.dragging = false
      }
    }
    const onFocusIn = (e: FocusEvent) => {
      if (isField(e.target)) releaseAll()
    }

    const down = (e: PointerEvent) => {
      // decide from THIS event's target: on touch the first event is the press itself, before any
      // move has told the shell whether the finger is over the world or over a panel
      const overWorld = !(e.target as Element | null)?.closest?.(UI_SELECTOR)
      live.pointer.overWorld = overWorld
      if (!piloting() || !overWorld) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button })
      if (pointers.size === 1) {
        startX = e.clientX
        startY = e.clientY
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
        centroid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      }
    }
    const move = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX
      p.y = e.clientY
      if (!piloting()) return
      if (pointers.size === 2) {
        // two fingers: pinch = zoom, drag = move across the world
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0) o.zoom = Math.min(2.8, Math.max(0.3, o.zoom * (pinch / d)))
        pinch = d
        const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        if (centroid) {
          inp.panX += c.x - centroid.x
          inp.panY += c.y - centroid.y
        }
        centroid = c
        o.dragging = true
        return
      }
      if (!o.dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) o.dragging = true
      if (!o.dragging) return
      if (p.button === 2 || p.button === 1) {
        inp.panX += dx
        inp.panY += dy
      } else {
        o.az -= dx * 0.0055
        o.pol += dy * 0.0045 // the rig clamps against the real elevation limits
      }
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size < 2) {
        pinch = 0
        centroid = null
      }
      // let the click event see the drag flag, then clear it
      if (pointers.size === 0) setTimeout(() => (o.dragging = false), 0)
    }
    const wheel = (e: WheelEvent) => {
      if (!active() || !live.pointer.overWorld) return
      e.preventDefault()
      if (!piloting()) return
      o.zoom = Math.min(2.8, Math.max(0.3, o.zoom * Math.exp(e.deltaY * 0.0011)))
    }
    const menu = (e: MouseEvent) => {
      if (active() && live.pointer.overWorld) e.preventDefault()
    }

    window.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('contextmenu', menu)
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('focusin', onFocusIn)
    // navigable modes own touch gestures (one-finger orbit); everywhere else the page scrolls.
    // Applied now as well as on change: a deep link can set the mode before this effect subscribes.
    const touchFor = (m: string) => (document.documentElement.style.touchAction = m === 'explore' || m === 'venue' ? 'none' : '')
    touchFor(useWorld.getState().mode)
    const unsub = useWorld.subscribe((s, p) => {
      if (s.mode === p.mode && s.filterOpen === p.filterOpen && s.navOpen === p.navOpen) return
      if (s.mode !== p.mode || s.filterOpen || s.navOpen) releaseAll()
      touchFor(s.mode)
    })
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('contextmenu', menu)
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('focusin', onFocusIn)
      unsub()
    }
  }, [])
  return null
}
