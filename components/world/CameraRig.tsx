'use client'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { live, useWorld, type CamState } from '@/lib/store'
import { dbg } from '@/lib/debug'
import { Flight } from '@/lib/flight'
import { blankKey, mixKey, type CamKey } from '@/lib/universe'
import { HALL } from '@/lib/constants'
import { audio } from '@/lib/audio'
import { fx } from '@/lib/fx'
import { S, T, damp } from './system'

/**
 * THE CAMERA AUTHORITY. The only code in the project that writes the camera.
 *
 * Every frame it resolves ONE owner, in strict priority:
 *   1 system     loader up: hold the boot view
 *   2 flight     a planned flight (lib/flight.ts) is running: autopilot; user input is held, never mixed in
 *   3 cinematic  scroll (home journey) or a route preset drives the base key
 *   3 user       explore / venue: the visitor pilots on top of the destination key
 *   4 idle       user mode, no input for a while: a very slow drift
 *
 * Control transfers without jumps: whenever the visitor's turn ends (new destination, route change),
 * their current view (orbit + zoom + pilot translation) is BAKED into the base key and the offsets
 * are zeroed, so the next owner starts from exactly what was on screen.
 *
 * Piloting is physical: input → wish vector in the camera's own basis (forward / right / up),
 * normalised so diagonals never exceed max speed → velocity with acceleration and damping →
 * position. Speed scales with the current view distance, so the hall and the solar system feel
 * equally flyable.
 */
const UP = new THREE.Vector3(0, 1, 0)
const IDLE_AFTER = 9
const ZERO = { az: 0, pol: 0, zoom: 1 }
const clamp = THREE.MathUtils.clamp

const JOURNEY_VIEWS: [number, string][] = [
  [0.5, 'SPACE'],
  [2.5, 'GALAXY'],
  [4, 'APPROACH'],
  [5.6, 'ORBIT'],
  [6.5, 'LANDING'],
  [8.6, 'VENUE'],
  [99, 'ORBIT'],
]
function viewName(camId: string) {
  if (live.warp > 0.05) return 'TRANSITION'
  if (camId === 'void') return 'SPACE'
  if (camId === 'journey') {
    const u = live.journey * 9
    return JOURNEY_VIEWS.find(([max]) => u < max)![1]
  }
  const kind = camId.split(':')[0]
  const names: Record<string, string> = { tx: 'TRANSMISSION', space: 'SPACE', galaxy: 'GALAXY', system: 'ORBIT', planet: 'ORBIT', venue: 'VENUE', zone: 'ZONE', event: 'EVENT', detail: 'DETAIL', sky: 'CONSTELLATION' }
  return names[kind] ?? kind.toUpperCase()
}

const venueLevel = () => {
  const st = useWorld.getState()
  return st.mode === 'venue' || st.nav.kind === 'venue' || st.nav.kind === 'zone' || st.nav.kind === 'event'
}

/** effective view = base key + the visitor's offsets (orbit, zoom, pilot translation) */
function compose(c: CamKey, off: typeof ZERO, p: THREE.Vector3, out: CamKey) {
  out.dir.copy(c.dir).applyAxisAngle(UP, off.az)
  if (Math.abs(off.pol) > 1e-5) {
    const elev = Math.asin(clamp(out.dir.y, -1, 1))
    const ne = clamp(elev + off.pol, 0.06, 1.45)
    const h = Math.hypot(out.dir.x, out.dir.z) || 1
    out.dir.set((out.dir.x / h) * Math.cos(ne), Math.sin(ne), (out.dir.z / h) * Math.cos(ne))
  }
  out.target.copy(c.target).add(p)
  out.dist = c.dist * off.zoom
  out.fov = c.fov
  return out
}

export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const cur = useRef(blankKey())
  const eff = useRef(blankKey())
  const inited = useRef(false)
  const lastId = useRef('')
  const state = useRef<CamState>('system')
  const flight = useMemo(() => new Flight(), [])
  const off = useRef({ ...ZERO })
  const pilot = useRef({ p: new THREE.Vector3(), v: new THREE.Vector3(), returning: false })
  const lastReset = useRef(0)
  const idle = useRef(0)
  const lastPointer = useRef({ x: 0, y: 0 })
  const par = useRef(new THREE.Vector2())
  const prev = useRef(new THREE.Vector3())
  const tmp = useMemo(
    () => ({ pos: new THREE.Vector3(), side: new THREE.Vector3(), fwd: new THREE.Vector3(), flat: new THREE.Vector3(), right: new THREE.Vector3(), camUp: new THREE.Vector3(), wish: new THREE.Vector3() }),
    [],
  )

  useEffect(() => {
    camera.near = 1
    camera.far = 420000
    camera.updateProjectionMatrix()
  }, [camera])

  useFrame((_, rawDt) => {
    // DEBUG_STATIC_CAMERA: nothing writes the camera; whatever still changes on screen is not camera motion
    if (dbg('staticcamera')) return
    const dt = Math.min(rawDt, 1 / 20)
    const t = T.current
    const st = useWorld.getState()
    const c = cur.current
    const P = pilot.current
    const o = off.current
    if (!inited.current) {
      mixKey(t.cam, t.cam, 0, c)
      inited.current = true
      lastId.current = t.camId
    }

    // ── 1. who owns the camera this frame
    const wasUser = state.current === 'user' || state.current === 'idle'
    const newDest = !t.scrubbed && t.camId !== lastId.current
    if ((wasUser && (t.scrubbed || !t.userControl)) || newDest) {
      // hand-over: bake what is on screen into the base key, then clear the visitor's offsets
      compose(c, o, P.p, eff.current)
      mixKey(eff.current, eff.current, 0, c)
      Object.assign(o, ZERO)
      Object.assign(live.orbit, ZERO)
      P.p.set(0, 0, 0)
      P.v.set(0, 0, 0)
      P.returning = false
    }
    let owner: CamState
    let flightSpeed = 0
    if (t.scrubbed) {
      flight.active = false
      mixKey(c, t.cam, 1 - Math.exp(-(st.reducedMotion ? 9 : 3.4) * dt), c)
      lastId.current = t.camId
      owner = 'cinematic'
    } else {
      if (newDest) {
        lastId.current = t.camId
        flight.plan(c, t.cam, st.reducedMotion, t.via)
        audio.engage()
      }
      const r = flight.step(dt)
      if (r) {
        mixKey(r.key, r.key, 0, c)
        flightSpeed = r.speed
        owner = 'flight'
        if (!flight.active && flight.landing) {
          // touchdown: a pulse where we arrived
          Object.assign(live.pulse, { x: c.target.x, y: 0.5, z: c.target.z, t: S.time, color: '#FFF4E0' })
          fx.land = S.time // the venue lights surge
          audio.land()
        }
      } else {
        mixKey(c, t.cam, 1 - Math.exp(-2.6 * dt), c)
        owner = t.userControl ? 'user' : 'cinematic'
      }
    }
    if (!st.booted) owner = 'system'
    live.flight = damp(live.flight, flightSpeed, 8, dt)

    // ── 2. the visitor's turn: orbit, zoom and piloting on top of the destination key
    const inp = live.input
    const venue = venueLevel()
    const scale = c.dist * o.zoom
    const maxSpeed = scale * (venue ? 0.42 : 0.38)
    if (owner === 'user') {
      if (inp.reset !== lastReset.current) {
        // R: glide back to the exploration orientation
        lastReset.current = inp.reset
        P.returning = true
        Object.assign(live.orbit, ZERO)
        audio.ping(0.9)
      }
      // the drag's elevation offset can never wander past what the view can do (no dead zone)
      const elev0 = Math.asin(clamp(c.dir.y, -1, 1))
      live.orbit.pol = clamp(live.orbit.pol, 0.06 - elev0, 1.45 - elev0)

      // movement basis from the camera's own orientation (never world axes)
      compose(c, o, P.p, eff.current)
      const fwd = tmp.fwd.copy(eff.current.dir).negate()
      const flat = tmp.flat.set(fwd.x, 0, fwd.z)
      if (flat.lengthSq() < 1e-6) flat.set(-Math.sin(o.az), 0, -Math.cos(o.az)) // looking straight down
      flat.normalize()
      const right = tmp.right.crossVectors(flat, UP).normalize()
      // in the hall, forward follows the floor (you fly over it, Q/E for altitude); in space it is truly 3D
      const ahead = venue ? flat : fwd
      const wish = tmp.wish.set(0, 0, 0).addScaledVector(ahead, inp.f).addScaledVector(right, inp.r).addScaledVector(UP, inp.u)
      const moving = wish.lengthSq() > 1e-6
      if (wish.lengthSq() > 1) wish.normalize() // W+A is never faster than W
      if (moving) P.returning = false
      // key down → acceleration builds; held → cruise; released → the ship settles
      wish.multiplyScalar(maxSpeed * (inp.boost ? 2.2 : 1))
      P.v.lerp(wish, 1 - Math.exp(-(moving ? 3.2 : 2.6) * dt))
      if (!moving && P.v.lengthSq() < (maxSpeed * 0.01) ** 2) P.v.set(0, 0, 0) // settled: truly at rest

      // two-finger / right-button drag: the world moves under the fingers
      if (inp.panX || inp.panY) {
        const k = (scale * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / Math.max(size.height, 1)
        P.p.addScaledVector(right, -inp.panX * k).addScaledVector(flat, inp.panY * k)
        inp.panX = inp.panY = 0
        P.returning = false
      }
      P.p.addScaledVector(P.v, dt)
      if (P.returning) {
        P.p.multiplyScalar(Math.exp(-3 * dt))
        P.v.multiplyScalar(Math.exp(-6 * dt))
        if (P.p.lengthSq() < 0.25) {
          P.p.set(0, 0, 0)
          P.returning = false
        }
      }

      // bounds: the hall keeps you over the deck; space keeps you near the destination
      if (venue) {
        // compare in world space: (t + p) − t ≠ p in floating point, and a false "hit" would zero
        // the velocity on every frame it happens (that stutter once made W/S feel broken)
        const wall = (axis: 'x' | 'y' | 'z', lo: number, hi: number) => {
          const w = c.target[axis] + P.p[axis]
          if (w < lo || w > hi) {
            P.p[axis] = clamp(w, lo, hi) - c.target[axis]
            P.v[axis] = 0
          }
        }
        wall('x', HALL.min[0] - 70, HALL.max[0] + 70)
        wall('z', HALL.min[1] - 70, HALL.max[1] + 70)
        wall('y', 0, 150)
      } else {
        const lim = c.dist * 4
        if (P.p.length() > lim) {
          P.p.setLength(lim)
          P.v.multiplyScalar(0.5)
        }
      }
      if (inp.zoom) live.orbit.zoom = clamp(live.orbit.zoom * Math.exp(inp.zoom * dt * 1.2), 0.3, 2.8)

      // idle: nothing touched for a while → a very slow drift (never while reading with the pointer)
      const pm = live.pointer
      const touched = moving || live.orbit.dragging || inp.zoom !== 0 || pm.px !== lastPointer.current.x || pm.py !== lastPointer.current.y || P.returning
      lastPointer.current.x = pm.px
      lastPointer.current.y = pm.py
      idle.current = touched ? 0 : idle.current + dt
      if (idle.current > IDLE_AFTER && !st.reducedMotion) {
        owner = 'idle'
        live.orbit.az -= dt * 0.012 * Math.min(1, (idle.current - IDLE_AFTER) / 3)
      }
    } else if (owner !== 'flight') {
      // not the visitor's turn: whatever is left of their motion settles away
      P.v.multiplyScalar(Math.exp(-6 * dt))
      P.p.multiplyScalar(Math.exp(-3 * dt))
      idle.current = 0
    } else {
      idle.current = 0
    }
    state.current = owner

    // offsets are damped for weight (drag / wheel feel heavy but never laggy)
    const want = owner === 'user' || owner === 'idle' ? live.orbit : ZERO
    o.az = damp(o.az, want.az, 7, dt)
    o.pol = damp(o.pol, want.pol, 7, dt)
    o.zoom = damp(o.zoom, want.zoom, 7, dt)

    // pilot readout, camera-local and normalised (the ship's attitude, engine and FX read this)
    const e = compose(c, o, P.p, eff.current)
    const lookDir = tmp.fwd.copy(e.dir).negate()
    tmp.right.crossVectors(lookDir, UP).normalize()
    tmp.camUp.crossVectors(tmp.right, lookDir).normalize()
    const inv = 1 / Math.max(maxSpeed, 1e-3)
    live.pilot.f = clamp(P.v.dot(lookDir) * inv, -2.2, 2.2)
    live.pilot.r = clamp(P.v.dot(tmp.right) * inv, -2.2, 2.2)
    live.pilot.u = clamp(P.v.dot(tmp.camUp) * inv, -2.2, 2.2)
    live.pilot.speed = Math.min(2.2, P.v.length() * inv)

    // ── 3. final pose: parallax (cinematic only), shake (only at real speed), FOV from speed
    const pa = st.reducedMotion || st.coarse || t.userControl ? 0 : 1
    par.current.x = damp(par.current.x, live.pointer.x * pa, 2.2, dt)
    par.current.y = damp(par.current.y, live.pointer.y * pa, 2.2, dt)
    tmp.side.crossVectors(e.dir, UP).normalize()
    const pos = tmp.pos.copy(e.target).addScaledVector(e.dir, e.dist)
    pos.addScaledVector(tmp.side, par.current.x * e.dist * 0.045).addScaledVector(UP, par.current.y * e.dist * 0.03)
    const shake = Math.max(S.warp - 0.5, 0) * 0.004 + Math.max(live.flight - 0.55, 0) * 0.002 + S.hyper * 0.0012
    if (shake > 0 && !st.reducedMotion) {
      pos.x += (Math.random() - 0.5) * shake * e.dist
      pos.y += (Math.random() - 0.5) * shake * e.dist
    }
    if (venue && pos.y < 6) pos.y = 6
    camera.position.copy(pos)
    camera.lookAt(e.target)
    const fov = e.fov + S.warp * 22 + live.flight * 9 + S.hyper * 12 + Math.max(0, live.pilot.f) * 5
    // near plane follows scale: more depth precision far out, never clipping the ship (≥ 5 units away)
    const near = clamp(e.dist * 0.0025, 1, 3)
    if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(camera.near - near) > near * 0.02) {
      camera.fov = fov
      camera.near = near
      camera.updateProjectionMatrix()
    }
    // everything that reads the camera later this frame (ship, labels, portal, projections) sees
    // THIS frame's pose, not last frame's: no one-frame lag, no jitter at speed
    camera.updateMatrixWorld()

    live.camState = owner
    live.camView = viewName(t.camId)
    live.camSpeed = camera.position.distanceTo(prev.current) / Math.max(dt, 1e-3)
    prev.current.copy(camera.position)
    live.alt = camera.position.y
    camera.getWorldDirection(tmp.fwd)
    live.cam.x = camera.position.x
    live.cam.y = camera.position.y
    live.cam.z = camera.position.z
    live.cam.heading = Math.atan2(tmp.fwd.x, -tmp.fwd.z)
    const camUnits = Math.min(1, live.camSpeed / Math.max(e.dist * 1.2, 300))
    live.speed = damp(live.speed, Math.min(1, Math.abs(live.scrollVel) * 0.04 + camUnits + live.warp + live.flight * 0.8 + S.hyper), 3, dt)
  }, -2)
  return null
}
