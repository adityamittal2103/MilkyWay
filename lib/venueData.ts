'use client'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { useWorld } from './store'

/**
 * Loads the pipeline outputs (see docs/VENUE-PIPELINE.md) with real byte progress, which the
 * loader UI reports. Decoded once and shared (a tiny suspense cache, no extra dependency).
 */

export type VenueMeta = {
  floor: { min: number[]; max: number[] }
  floorMarks: number[][]
  walls: number[][] // [x0, z0, x1, z1, height]
  points: { count: number; min: number[]; max: number[]; kinds: string[] }
  bulbs: number
  stats: { src_tris: number; out_tris: number }
}

export type VenueData = {
  meta: VenueMeta
  meshes: Record<'wall' | 'furniture' | 'prop' | 'emissive', THREE.BufferGeometry | null>
  points: Float32Array // xyz, venue surface samples (shuffled: any prefix is a uniform subsample)
  kinds: Uint8Array
  bulbs: Float32Array
}

const FILES = {
  glb: '/models/venue.glb',
  points: '/models/venue-points.bin',
  bulbs: '/models/venue-bulbs.bin',
  meta: '/data/venue-meta.json',
}
const WEIGHTS = { glb: 0.35, points: 0.5, bulbs: 0.05, meta: 0.1 }
const loaded: Record<keyof typeof FILES, number> = { glb: 0, points: 0, bulbs: 0, meta: 0 }
const report = () => {
  const p = (Object.keys(loaded) as (keyof typeof FILES)[]).reduce((a, k) => a + loaded[k] * WEIGHTS[k], 0)
  useWorld.getState().set({ progress: Math.round(p * 100) })
}

async function fetchWithProgress(key: keyof typeof FILES): Promise<ArrayBuffer> {
  const res = await fetch(FILES[key])
  if (!res.ok || !res.body) throw new Error(`venue asset ${key} failed: ${res.status}`)
  const total = Number(res.headers.get('content-length')) || 0
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
    loaded[key] = total ? Math.min(0.99, got / total) : Math.min(0.9, loaded[key] + 0.1)
    report()
  }
  const out = new Uint8Array(got)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  loaded[key] = 1
  report()
  return out.buffer
}

async function load(): Promise<VenueData> {
  const [glbBuf, ptsBuf, bulbBuf, metaBuf] = await Promise.all([
    fetchWithProgress('glb'),
    fetchWithProgress('points'),
    fetchWithProgress('bulbs'),
    fetchWithProgress('meta'),
  ])
  const meta: VenueMeta = JSON.parse(new TextDecoder().decode(metaBuf))

  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.parseAsync(glbBuf, '')
  const meshes: VenueData['meshes'] = { wall: null, furniture: null, prop: null, emissive: null }
  gltf.scene.updateMatrixWorld(true)
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    // bake the dequantisation transform so every geometry is in plain world units
    // (positions arrive as normalised int16; expand to float before transforming or they clamp)
    const src = m.geometry.getAttribute('position')
    const f = new Float32Array(src.count * 3)
    for (let i = 0; i < src.count; i++) {
      f[i * 3] = src.getX(i)
      f[i * 3 + 1] = src.getY(i)
      f[i * 3 + 2] = src.getZ(i)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(f, 3))
    if (m.geometry.index) g.setIndex(m.geometry.index)
    g.applyMatrix4(m.matrixWorld)
    g.computeBoundingSphere()
    const key = (m.name || m.parent?.name || '') as keyof VenueData['meshes']
    if (key in meshes) meshes[key] = g
  })

  // quantised points: uint16 xyz, then uint8 kinds
  const n = meta.points.count
  const q = new Uint16Array(ptsBuf, 0, n * 3)
  const kinds = new Uint8Array(ptsBuf, n * 6, n)
  const points = new Float32Array(n * 3)
  const { min, max } = meta.points
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 3; k++) points[i * 3 + k] = min[k] + (q[i * 3 + k] / 65535) * (max[k] - min[k])
  }
  return { meta, meshes, points, kinds, bulbs: new Float32Array(bulbBuf) }
}

let promise: Promise<VenueData> | null = null
let result: VenueData | null = null
let error: unknown = null

export function preloadVenue() {
  if (!promise)
    promise = load().then(
      (d) => (result = d),
      (e) => {
        error = e
        throw e
      },
    )
  return promise
}

/** Suspense-style accessor */
export function useVenueData(): VenueData {
  if (result) return result
  if (error) throw error
  throw preloadVenue()
}
