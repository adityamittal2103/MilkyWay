import * as THREE from 'three'
import { SECTIONS } from '@/data/sections'

/** Section constellations placed on the far-sky sphere (world code only). */
export const SECTION_RADIUS = 24000

const up = new THREE.Vector3(0, 1, 0)
export const SECTION_SKY = SECTIONS.map((s) => {
  const az = THREE.MathUtils.degToRad(s.az)
  const el = THREE.MathUtils.degToRad(s.el)
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize()
  const centre = dir.clone().multiplyScalar(SECTION_RADIUS)
  const right = new THREE.Vector3().crossVectors(dir, up).normalize()
  const upv = new THREE.Vector3().crossVectors(right, dir).normalize()
  const stars = s.stars.map(([x, y]) => centre.clone().addScaledVector(right, x * s.scale).addScaledVector(upv, y * s.scale))
  const top = stars.reduce((a, b) => (b.y > a.y ? b : a), stars[0])
  return { ...s, centre, stars, labelAt: top.clone().addScaledVector(upv, s.scale * 0.45) }
})
