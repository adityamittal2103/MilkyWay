'use client'
import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useWorld } from '@/lib/store'
import { useDebug, stats } from '@/lib/debug'
import { COLOR, QUALITY } from '@/lib/constants'
import { preloadVenue } from '@/lib/venueData'
import { Systems } from './Systems'
import { CameraRig } from './CameraRig'
import { QualityGovernor } from './QualityGovernor'
import { Starfield } from './Starfield'
import { StationCloud } from './StationCloud'
import { Venue } from './Venue'
import { SectorBeacon, DockPad } from './Sectors'
import { LabelProjector } from './LabelProjector'
import { Sky } from './Sky'
import { SectionSky } from './SectionSky'
import { Orbits } from './Orbits'
import { Ship } from './Ship'
import { EventMarkers, HeatParticles } from './EventMarkers'
import { Galaxy } from './cosmos/Galaxy'
import { Nebulae } from './cosmos/Nebulae'
import { SkyField } from './cosmos/SkyField'
import { Planets } from './cosmos/Planets'
import { Station, Beacon } from './cosmos/Station'
import { Debris } from './cosmos/Debris'
import { Dust } from './cosmos/Dust'
import { Sun, Burst, Portal } from './vfx/Effects'
import { EnergyPath } from './vfx/EnergyPath'
import { WorldInteractions } from './WorldInteractions'

/**
 * Ready = venue assets decoded AND every shader in the scene compiled. Compiling up front means
 * the first real frames don't stutter (and don't fool the quality monitor).
 */
function Ready() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  useEffect(() => {
    let alive = true
    const done = () => alive && useWorld.getState().set({ ready: true })
    const r = gl as THREE.WebGLRenderer & { compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown> }
    if (r.compileAsync) r.compileAsync(scene, camera).then(done, done)
    else {
      gl.compile(scene, camera)
      done()
    }
    return () => {
      alive = false
    }
  }, [gl, scene, camera])
  return null
}

/**
 * Staged boot: layers mount one idle slot at a time (core → far → mid → station/venue),
 * so shader compilation and buffer uploads arrive as several short tasks instead of one long
 * freeze. The cold open only needs stage 0; the rest lands while it plays.
 */
function useStages(total: number) {
  const [n, setN] = useState(1)
  useEffect(() => {
    if (n >= total) return
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setN((x) => x + 1), { timeout: 400 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = setTimeout(() => setN((x) => x + 1), 120)
    return () => clearTimeout(t)
  }, [n, total])
  return n
}

/** First frame drawn → the loader may lift for the cold open. */
function CoreReady() {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    useWorld.getState().set({ coreReady: true })
  })
  return null
}

// post-processing is only downloaded on tiers that use it (not on phones)
const Post = lazy(() => import('./vfx/Post').then((m) => ({ default: m.Post })))
// the artist transmission: its own chunk, fetched when the visitor opens the Transmissions
const Transmission = lazy(() => import('./Transmission').then((m) => ({ default: m.Transmission })))
// developer-only diagnostics: a separate chunk, only with ?debug
const DebugProbe = lazy(() => import('./DebugProbe').then((m) => ({ default: m.DebugProbe })))

export default function WorldCanvas() {
  // everything is ALLOCATED for the boot tier and never remounts; the governor only shrinks budgets
  const bootTier = useWorld((s) => s.bootTier)
  const q = QUALITY[bootTier]
  const debug = useDebug((s) => s.enabled)
  const artists = useWorld((s) => s.mode === 'artists')
  const noPost = useDebug((s) => s.flags.nopost)
  const fixedDpr = useDebug((s) => s.flags.fixeddpr)
  const maxDpr = typeof window === 'undefined' ? 1 : Math.min(q.dpr[1], window.devicePixelRatio || 1)
  const [dpr, setDpr] = useState(maxDpr)
  const qa = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa')
  const stage = useStages(5)
  const post = q.post !== 'none' && !noPost
  stats.post = post

  useEffect(() => {
    preloadVenue().catch(() => useWorld.getState().set({ webgl: false }))
  }, [])
  useEffect(() => {
    if (fixedDpr) setDpr(maxDpr)
  }, [fixedDpr, maxDpr])

  return (
    <Canvas
      className="world-canvas"
      dpr={dpr}
      flat
      gl={{ antialias: q.antialias && q.post === 'none', powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: qa }}
      camera={{ fov: 40, near: 1, far: 420000, position: [0, 2600, 4200] }}
      eventSource={typeof document !== 'undefined' ? document.body : undefined}
      eventPrefix="client"
      onCreated={(state) => {
        const { gl, scene } = state
        if (process.env.NODE_ENV !== 'production' || qa) (window as unknown as { __r3f: unknown }).__r3f = state
        scene.background = new THREE.Color(COLOR.void)
        gl.setClearColor(COLOR.void)
      }}
    >
      <QualityGovernor maxDpr={maxDpr} onDpr={setDpr} />
      <Systems />
      <CameraRig />
      <hemisphereLight args={['#CFE0FF', '#141A33', 0.55]} />
      <directionalLight position={[-3, 5, 4]} intensity={1.35} color="#F1EDE4" />
      <directionalLight position={[4, -1, -3]} intensity={1.6} color="#5B8CFF" />

      {/* stage 0 · the cold open: stars + the ship */}
      <Starfield />
      <Ship />
      <CoreReady />
      {/* stage 1 · LAYER 1, far */}
      {stage > 1 && (
        <>
          <SkyField />
          <Sun />
        </>
      )}
      {/* stage 2 · LAYER 2, mid */}
      {stage > 2 && (
        <>
          <Nebulae />
          <Galaxy />
          <Planets />
          <Debris />
          <Dust />
        </>
      )}
      {/* stage 3+ · LAYER 4, the station, venue and everything interactive */}
      {stage > 3 && (
        <>
          <Station />
          <Beacon />
          <Suspense fallback={null}>
            <StationCloud />
            <Venue />
            <SectorBeacon />
            <EventMarkers />
            <HeatParticles />
            <DockPad />
            <Ready />
          </Suspense>
        </>
      )}
      {stage > 4 && (
        <>
          <Sky />
          <SectionSky />
          <Orbits />
        </>
      )}
      {artists && (
        <Suspense fallback={null}>
          <Transmission />
        </Suspense>
      )}
      <group userData={{ vfx: true }}>
        <Burst />
        <Portal />
        <EnergyPath />
      </group>
      <LabelProjector />
      <WorldInteractions />
      {post && (
        <Suspense fallback={null}>
          <Post />
        </Suspense>
      )}
      {debug && (
        <Suspense fallback={null}>
          <DebugProbe />
        </Suspense>
      )}
    </Canvas>
  )
}
