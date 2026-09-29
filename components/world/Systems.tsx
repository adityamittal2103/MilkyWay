'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { direct } from '@/lib/director'
import { live, useWorld } from '@/lib/store'
import { BREAKPOINT } from '@/lib/constants'
import { applyFilter } from '@/lib/filter'
import { dbg } from '@/lib/debug'
import { fx, envelope } from '@/lib/fx'
import { EVENT_ANCHORS } from '@/lib/director'
import { planetPosition } from '@/lib/universe'
import { zoneAt, ZONES } from '@/data/zones'
import { CATEGORIES } from '@/data/categories'
import { PLANETS } from '@/data/planets'
import { EVENTS } from '@/data/provisional/events'
import { S, T, U, damp } from './system'

const DEFAULT_ACCENT = new THREE.Color('#6A5CFF') // electric violet: the universe's resting light
const tmpColor = new THREE.Color()

/**
 * Runs first every frame (negative priority):
 *  1. director → targets   2. smoothing → S   3. filter → world reactions   4. S → shared uniforms
 *  5. pointer → floor hit / sector hover
 */
export function Systems() {
  const size = useThree((s) => s.size)
  const ray = useMemo(() => new THREE.Raycaster(), [])
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])
  const lastZone = useRef<string | null>(null)
  const react = useRef({ filter: '', nav: '', sky: -1, heatFrom: new Float32Array(ZONES.length) })
  const tv = useMemo(() => ({ a: new THREE.Vector3(), f: new THREE.Vector3(), c: new THREE.Vector3() }), [])

  useFrame(({ camera, viewport }, rawDt) => {
    // DEBUG_STATIC_WORLD freezes the world clock and every damped channel: what still changes is not animation
    const dt = dbg('staticworld') ? 0 : Math.min(rawDt, 1 / 20)
    const st = useWorld.getState()
    const rm = st.reducedMotion
    const mobile = size.width < BREAKPOINT.mobile
    // hover is re-resolved every frame by whichever 3D system owns the thing under the pointer
    live.hoverKind = null
    live.hoverLabel = ''
    T.current = direct({
      mode: st.mode,
      journey: live.journey,
      introDone: st.introDone,
      nav: st.nav,
      selectedZone: st.selectedZone,
      hoveredZone: st.hoveredZone,
      selectedCategory: st.selectedCategory ?? st.hoveredCategory,
      selectedEvent: st.mode === 'events' || st.mode === 'competitions' || st.mode === 'venue' ? st.selectedEvent : null,
      filter: st.filter,
      mobile,
      transmission: st.transmission,
    })
    const t = T.current
    const k = rm ? 4 : 1 // reduced motion: settle quickly instead of travelling
    S.time += dt
    live.clock = S.time
    S.morph = damp(S.morph, t.morph, 1.5 * k, dt)
    S.reveal = damp(S.reveal, t.reveal, 1.8 * k, dt)
    S.lights = damp(S.lights, t.lights, 2.6 * k, dt)
    S.sky = damp(S.sky, t.sky, 2.4 * k, dt)
    S.sectionSky = damp(S.sectionSky, t.sectionSky, 2 * k, dt)
    S.orbits = damp(S.orbits, t.orbits, 2.4 * k, dt)
    S.dock = damp(S.dock, t.dock, 2 * k, dt)
    S.dim = damp(S.dim, t.dim, 2, dt)
    S.galaxy = damp(S.galaxy, t.galaxy, 1.6 * k, dt)
    S.cloud = damp(S.cloud, t.cloud, 1.8 * k, dt)
    S.markers = damp(S.markers, t.markers, 3 * k, dt)
    S.dust = damp(S.dust, t.dust, 2, dt)
    S.hyper = rm ? 0 : damp(S.hyper, t.hyper, 4, dt)
    S.planetLabels = damp(S.planetLabels, t.planetLabels, 4, dt)
    S.warp = rm ? 0 : live.warp
    S.flight = rm ? 0 : live.flight
    for (let i = 0; i < ZONES.length; i++) {
      S.zoneLight[i] = damp(S.zoneLight[i], t.zoneLight[i], 3.2, dt)
      S.zoneFocus[i] = damp(S.zoneFocus[i], i === t.focusZone ? 1 : 0, 7, dt)
    }

    // ── world reactions (lib/fx.ts): detect the moments, then derive envelopes
    const f = applyFilter(st.filter)
    const filtered = f.def.id !== 'all'
    const R = react.current
    if (st.filter !== R.filter) {
      if (R.filter) {
        // a colour field propagates from the hall's centre: floor wave + 3D burst + staggered heat
        fx.filter = S.time
        fx.filterColor = filtered ? f.def.accent : '#6A5CFF'
        R.heatFrom.set(S.zoneHeat)
        U.uFilterWave.value.set(0, -5, S.time, 320)
        Object.assign(live.pulse, { x: 0, y: 0.5, z: -5, t: S.time, color: fx.filterColor })
      }
      R.filter = st.filter
    }
    const navKey = st.mode + ':' + st.nav.kind + ('id' in st.nav ? st.nav.id : '') + ':' + (st.selectedEvent ?? '')
    if (navKey !== R.nav) {
      const was = R.nav
      R.nav = navKey
      // an energy path from the ship to what was just selected, before the flight engages
      let to: THREE.Vector3 | null = null
      let col = '#3FE0FF'
      if (st.mode === 'explore' && st.nav.kind === 'planet') {
        const p = PLANETS.find((x) => x.id === (st.nav as { id: string }).id)
        if (p) {
          to = planetPosition(p, tv.a)
          col = p.accent
          fx.planet = S.time
        }
      } else if ((st.mode === 'explore' || st.mode === 'venue') && (st.nav.kind === 'event' || st.selectedEvent)) {
        const slug = st.nav.kind === 'event' ? st.nav.id : st.selectedEvent!
        const a = EVENT_ANCHORS.get(slug)
        const e = EVENTS.find((x) => x.slug === slug)
        if (a) {
          to = tv.a.set(a.x, 12, a.z)
          col = CATEGORIES.find((c) => c.id === e?.category)?.accent ?? col
        }
      } else if (st.mode === 'explore' && st.nav.kind === 'zone') {
        const z = ZONES.find((x) => x.id === (st.nav as { id: string }).id)
        if (z) {
          to = tv.a.set(z.centre[0], 4, z.centre[2])
          col = z.accent
        }
      }
      if (to && was) {
        camera.getWorldDirection(tv.f)
        tv.c.copy(camera.position).addScaledVector(tv.f, 9).add(tv.a.clone().set(0, -1.2, 0))
        fx.target = S.time
        fx.targetFrom = [tv.c.x, tv.c.y, tv.c.z]
        fx.targetTo = [to.x, to.y, to.z]
        fx.targetColor = col
      }
    }
    const skyFound = st.discovered.reduce((n, d) => n + (d.startsWith('sky:') ? 1 : 0), 0)
    if (R.sky >= 0 && skyFound > R.sky) fx.sky = S.time
    R.sky = skyFound
    const fFlash = envelope(S.time, fx.filter, 0.06, 0.9)
    const pFlash = envelope(S.time, fx.planet, 0.05, 1.1)
    const sFlash = envelope(S.time, fx.sky, 0.1, 1.4)
    const lFlash = envelope(S.time, fx.land, 0.04, 1.6)
    U.uFlash.value = Math.max(fFlash * 0.7, pFlash, sFlash * 0.6)
    U.uSurge.value = Math.max(lFlash, fFlash * 0.6)

    // ── the filter shapes the world (heat, constellations, planets, event markers, accent light)
    S.filterAmt = damp(S.filterAmt, filtered ? 1 : 0, 3, dt)
    // sectors heat as the wavefront reaches them (≈ 320 units/s from the hall's centre)
    const since = S.time - fx.filter
    for (let i = 0; i < ZONES.length; i++) {
      const reach = Math.hypot(ZONES[i].centre[0], ZONES[i].centre[2] + 5) / 320
      const target = since < reach ? R.heatFrom[i] : filtered ? f.zoneHeat[i] : 0
      S.zoneHeat[i] = damp(S.zoneHeat[i], target, since < reach + 0.5 ? 9 : 3, dt)
    }
    const catSel = st.selectedCategory ?? st.hoveredCategory
    for (let i = 0; i < CATEGORIES.length; i++) {
      S.catFocus[i] = damp(S.catFocus[i], CATEGORIES[i].id === catSel ? 1 : 0, 6, dt)
      S.catFilter[i] = damp(S.catFilter[i], filtered && f.categories.has(CATEGORIES[i].id) ? 1 : 0, 3, dt)
    }
    const selPlanet = st.nav.kind === 'planet' ? st.nav.id : null
    for (let i = 0; i < PLANETS.length; i++) {
      const id = PLANETS[i].id
      const match = filtered && f.planets.has(id)
      const want = (id === st.hoveredPlanet || id === selPlanet ? 1 : match ? 0.55 : 0) + (match ? fFlash * 0.9 : 0) + (id === selPlanet ? pFlash * 0.8 : 0)
      S.planetHi[i] = damp(S.planetHi[i], want, 7, dt)
    }
    const selEvent = st.nav.kind === 'event' ? st.nav.id : st.selectedEvent
    for (let i = 0; i < EVENTS.length; i++) {
      S.evOn[i] = damp(S.evOn[i], !filtered || f.events.has(EVENTS[i].slug) ? 1 : 0.12, 4, dt)
      // matching markers pulse as the colour field passes over them
      const pulse = filtered && f.events.has(EVENTS[i].slug) ? fFlash : 0
      S.evHot[i] = damp(S.evHot[i], Math.max(EVENTS[i].slug === st.hoveredEvent || EVENTS[i].slug === selEvent ? 1 : 0, pulse), 9, dt)
    }
    // exploration progress: charted places slowly change the galaxy itself
    const charted = st.discovered.filter((d) => /^(zone|planet|sky):/.test(d)).length
    S.chart = damp(S.chart, Math.min(1, charted / 21), 0.8, dt)
    U.uChart.value = S.chart
    tmpColor.set(filtered ? f.def.accent : DEFAULT_ACCENT)
    S.accent.lerp(tmpColor, 1 - Math.exp(-3 * dt))

    U.uTime.value = S.time
    U.uMorph.value = S.morph
    U.uReveal.value = S.reveal
    U.uLights.value = S.lights
    U.uDim.value = S.dim
    // hierarchy: the galaxy is background. It steps back when the hall or the station is the subject
    // (markers up), and when a panel dims the world, so Yashobhoomi and the ship always read first.
    U.uGlow.value = S.galaxy * (1 - 0.42 * S.markers) * (1 - 0.35 * S.dim)
    U.uCloud.value = S.cloud
    U.uWarp.value = S.warp
    U.uFlight.value = S.flight
    U.uFilterAmt.value = S.filterAmt
    for (let i = 0; i < ZONES.length; i++) {
      U.uZoneLight.value[i] = S.zoneLight[i]
      U.uZoneFocus.value[i] = S.zoneFocus[i]
      U.uZoneHeat.value[i] = S.zoneHeat[i]
    }
    const cam = camera as THREE.PerspectiveCamera
    U.uDpr.value = viewport.dpr
    U.uRes.value.set(size.width * viewport.dpr, size.height * viewport.dpr)
    U.uProj.value = (size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2))
    U.uPulse.value.set(live.pulse.x, live.pulse.y, live.pulse.z, live.pulse.t)
    U.uPulseColor.value.set(live.pulse.color)

    // ── pointer → hall floor
    const p = live.pointer
    ndc.set(p.x, p.y)
    U.uPointerNdc.value.copy(ndc)
    ray.setFromCamera(ndc, camera)
    const ok = ray.ray.intersectPlane(plane, hit)
    live.floor.hit = !!ok && p.active
    if (ok) {
      live.floor.x = hit.x
      live.floor.z = hit.z
      U.uPointer.value.lerp(hit, 1 - Math.exp(-14 * dt))
    }
    U.uPointerAmt.value = damp(U.uPointerAmt.value, p.active && p.overWorld ? 1 : 0, 5, dt)

    // ── sector hover: a world interaction wherever the hall is navigable
    const venueLevel = st.mode === 'venue' || (st.mode === 'explore' && (st.nav.kind === 'venue' || st.nav.kind === 'zone' || st.nav.kind === 'event'))
    if (venueLevel && !st.coarse) {
      const z = p.active && p.overWorld && !live.orbit.dragging && live.floor.hit && !st.hoveredEvent ? zoneAt(live.floor.x, live.floor.z) : null
      const id = z?.id ?? null
      if (id !== lastZone.current) {
        lastZone.current = id
        useWorld.getState().set({ hoveredZone: id })
      }
      if (id) {
        live.hoverKind = 'zone'
        live.hoverLabel = z!.name
      }
    } else if (lastZone.current && st.mode !== 'home') {
      lastZone.current = null
    }
  }, -3)
  return null
}

