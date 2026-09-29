'use client'
import { tween, cancelTween, EASE } from './tween'
import { live, useWorld } from './store'
import { audio } from './audio'

/**
 * Route changes are travel (WOW 10). A jump: warp builds (650 ms, power3.in) → the route
 * swaps at peak → the camera arrives at the new preset while warp decays (900 ms, expo.out).
 * With reduced motion it is a short crossfade: same destination, no travel.
 */
let navigate: ((href: string) => void) | null = null
export const registerNavigate = (fn: (href: string) => void) => {
  navigate = fn
}

let pending: string | null = null

export function jump(href: string, label: string) {
  const st = useWorld.getState()
  const path = href.split('#')[0].split('?')[0]
  if (!navigate) return false
  if (st.transition.active) return true
  if (path === window.location.pathname) {
    st.set({ navOpen: false })
    return true
  }
  pending = path
  st.set({ transition: { active: true, label, href }, navOpen: false })
  audio.whoosh()
  if (st.reducedMotion || !st.webgl) {
    live.warp = 0
    navigate(href)
    return true
  }
  tween(live, 'warp', 1, 0.65, EASE.power3In, { onComplete: () => navigate?.(href) })
  return true
}

/** Called by RouteSync once the new route has rendered. */
export function arrive(pathname: string, fromHistory = false) {
  const st = useWorld.getState()
  if (!st.transition.active) {
    // back / forward: the same travel language as a jump (we arrive through the warp) instead of
    // an unmasked flight across the whole galaxy
    if (!fromHistory || st.reducedMotion || !st.webgl) return
    cancelTween(live, 'warp')
    live.warp = 0.85
    st.set({ transition: { active: true, label: '', href: pathname } })
    tween(live, 'warp', 0, 1.1, EASE.expoOut, { delay: 0.05, onComplete: () => useWorld.getState().set({ transition: { active: false, label: '', href: null } }) })
    return
  }
  if (pending && pending !== pathname) return
  pending = null
  cancelTween(live, 'warp')
  tween(live, 'warp', 0, st.reducedMotion ? 0.2 : 0.9, EASE.expoOut, {
    delay: 0.05,
    onComplete: () => useWorld.getState().set({ transition: { active: false, label: '', href: null } }),
  })
}
