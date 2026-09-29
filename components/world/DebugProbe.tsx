'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { dbg, stats, useDebug } from '@/lib/debug'

/**
 * Developer-only, mounted inside the canvas when `?debug` is present.
 *  - publishes frame stats (fps, worst frame, draw calls, triangles, programs…) for the panel
 *  - applies the visibility switches through render LAYERS, never `.visible`, so it cannot fight
 *    the components that animate visibility themselves. Hidden = moved to layer 31, which the
 *    camera does not render.
 */
const HIDDEN = 31

function hiddenBy(o: THREE.Object3D, inVfx: boolean) {
  const f = useDebug.getState().flags
  const r = o as THREE.Mesh
  if (!('material' in r) || !r.material) return false
  const mats = Array.isArray(r.material) ? r.material : [r.material]
  if (f.noparticles && (o as THREE.Points).isPoints) return true
  if (f.notransparency && mats.some((m) => m.transparent)) return true
  if (f.novfx && inVfx) return true
  return false
}

export function DebugProbe() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const acc = useRef({ n: 0, t: 0, worst: 0 })
  const tick = useRef(0)

  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
    }
  }, [gl])

  // shadows: nothing in this scene casts them (they were never enabled); the switch enforces it
  useEffect(
    () =>
      useDebug.subscribe((s) => {
        gl.shadowMap.enabled = !s.flags.noshadows && gl.shadowMap.enabled
      }),
    [gl],
  )

  useFrame((_, dt) => {
    // info covers every render call of the previous frame (scene + every post pass)
    const r = gl.info.render
    stats.calls = r.calls
    stats.triangles = r.triangles
    stats.points = r.points
    stats.lines = r.lines
    stats.programs = gl.info.programs?.length ?? 0
    stats.geometries = gl.info.memory.geometries
    stats.textures = gl.info.memory.textures
    stats.dpr = gl.getPixelRatio()
    gl.info.reset()

    const a = acc.current
    a.n++
    a.t += dt
    a.worst = Math.max(a.worst, dt)
    if (a.t >= 0.5) {
      stats.fps = a.n / a.t
      stats.frameMs = (a.t / a.n) * 1000
      stats.worstMs = a.worst * 1000
      a.n = 0
      a.t = 0
      a.worst = 0
    }

    // layer switches: re-applied a few times a second (objects mount while the world stages in)
    if (++tick.current % 10) return
    const any = dbg('noparticles') || dbg('notransparency') || dbg('novfx')
    const walk = (o: THREE.Object3D, inVfx: boolean) => {
      const vfx = inVfx || o.userData.vfx === true
      if (any && hiddenBy(o, vfx)) o.layers.set(HIDDEN)
      else if (o.layers.mask === 1 << HIDDEN) o.layers.set(0)
      for (const c of o.children) walk(c, vfx)
    }
    walk(scene, false)
  }, -100)

  return null
}
