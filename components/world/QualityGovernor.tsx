'use client'
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { live, useWorld } from '@/lib/store'
import { dbg } from '@/lib/debug'
import { TIER_DOWN } from '@/lib/constants'

/**
 * Adaptive quality with hysteresis. Quality changes are rare and deliberate, never a flip-flop.
 *
 *  - It only JUDGES when nothing cinematic is happening: not while loading or compiling, not during
 *    the intro, a camera flight, a route warp, an artist transmission, a resize, or with the tab
 *    hidden. After any of those ends it waits a stabilisation window before judging again.
 *  - DOWN needs 4 consecutive bad one-second windows (< 40 fps). First the resolution steps down,
 *    only then the budget tier. Every change starts a 12 s cooldown.
 *  - UP needs 30 s of consistently smooth frames (> 57 fps), resolution only, one step at a time.
 *    If a step up is ever followed by a step down, upgrades are disabled for the session.
 *  - Tier changes never remount anything: components shrink their draw ranges (see useBudget).
 */
const BAD_FPS = 40
const GOOD_FPS = 57
const DOWN_WINDOWS = 4
const UP_WINDOWS = 30
const COOLDOWN = 12
const SETTLE = 2.5

export function QualityGovernor({ maxDpr, onDpr }: { maxDpr: number; onDpr: (d: number) => void }) {
  const setDpr = useThree((s) => s.setDpr)
  const dpr = useThree((s) => s.viewport.dpr)
  const g = useRef({ frames: 0, time: 0, bad: 0, good: 0, calm: 0, cooldown: 0, lastDir: 0, noUp: false, resized: 0 })
  const size = useThree((s) => s.size)

  // a resize is not a performance signal
  useEffect(() => {
    g.current.resized = performance.now()
  }, [size.width, size.height])

  useFrame((_, dt) => {
    const s = g.current
    const st = useWorld.getState()
    const q = live.quality
    let hold = ''
    if (st.tierLocked || dbg('fixedquality')) hold = 'fixed'
    else if (!st.booted || !st.ready) hold = 'loading'
    else if (st.mode === 'home' && !st.introDone) hold = 'intro'
    else if (st.transition.active || live.warp > 0.01) hold = 'route warp'
    else if (live.camState === 'flight' || live.flight > 0.05) hold = 'camera flight'
    else if (live.qualityHold > 0) hold = 'transmission'
    else if (typeof document !== 'undefined' && document.hidden) hold = 'tab hidden'
    else if (performance.now() - s.resized < 2000) hold = 'resize'
    if (hold) {
      q.state = hold === 'fixed' ? 'locked' : 'hold'
      q.reason = hold
      s.frames = s.time = s.calm = 0
      return
    }
    // the stabilisation window after anything cinematic (and after boot)
    s.calm += dt
    if (s.calm < SETTLE) {
      q.state = 'settling'
      q.reason = ''
      return
    }
    if (s.cooldown > 0) {
      s.cooldown -= dt
      q.state = 'cooldown'
      q.reason = `${s.cooldown.toFixed(0)} s`
      return
    }
    q.state = 'watching'
    q.reason = ''
    // one-second windows; a single hitch (> 250 ms) is a GC or tab switch, not a trend
    if (dt > 0.25) return
    s.frames++
    s.time += dt
    if (s.time < 1) return
    const fps = s.frames / s.time
    s.frames = s.time = 0
    if (fps < BAD_FPS) {
      s.bad++
      s.good = 0
    } else if (fps > GOOD_FPS) {
      s.good++
      s.bad = 0
    } else {
      s.bad = Math.max(0, s.bad - 1)
      s.good = 0
    }

    if (s.bad >= DOWN_WINDOWS) {
      s.bad = s.good = 0
      s.cooldown = COOLDOWN
      if (s.lastDir > 0) s.noUp = true // it went up and could not hold it: stay down from now on
      s.lastDir = -1
      if (dbg('fixeddpr') || dpr <= 1.01) {
        if (st.tier !== 'low') st.set({ tier: TIER_DOWN[st.tier] })
      } else {
        const d = Math.max(1, Math.round((dpr - 0.5) * 4) / 4)
        setDpr(d) // applied inside this frame: no stretched or cleared frame
        onDpr(d) // keep the Canvas prop in sync so a re-render can never revert it
      }
      q.reason = `stepped down at ${fps.toFixed(0)} fps`
      return
    }
    if (s.good >= UP_WINDOWS && !s.noUp && !dbg('fixeddpr') && dpr < maxDpr - 0.01) {
      s.good = 0
      s.cooldown = COOLDOWN
      s.lastDir = 1
      const d = Math.min(maxDpr, dpr + 0.25)
      setDpr(d)
      onDpr(d)
      q.reason = 'stepped up'
    }
  })
  return null
}
