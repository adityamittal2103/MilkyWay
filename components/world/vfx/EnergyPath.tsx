'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { fx } from '@/lib/fx'
import { S } from '../system'
import { glowLineGeometry, glowLineMaterial, glowLines } from './glowLines'

/**
 * SELECT → TARGET LOCK → ENERGY PATH → ENGAGE. When the visitor picks a destination, an arc of
 * light draws itself from the ship to it (≈ 0.45 s, a bright head leading), holds while the ship
 * engages, then fades as the flight carries the camera along it. One glow line, rebuilt only when
 * a new target fires; never drawn otherwise.
 */
const N = 96
const DRAW = 0.45
const LIFE = 2.2

export function EnergyPath() {
  const last = useRef(-10)
  const { mesh, mat, geo } = useMemo(() => {
    const t = Array.from({ length: N * 2 }, (_, i) => Math.floor(i / 2) / N + (i % 2) / N)
    const geo = glowLineGeometry(new Float32Array(N * 6), t)
    const mat = glowLineMaterial({
      width: 3.4,
      depthTest: false,
      uniforms: { uDraw: { value: 0 }, uLife: { value: 0 } },
      fragment: {
        head: 'uniform float uDraw; uniform float uLife;',
        body: `if (vT > uDraw) discard;
          float head = smoothstep(0.12, 0.0, uDraw - vT) * (1.0 - step(0.999, uDraw));
          float flow = 0.55 + 0.45 * sin(vT * 60.0 - uTime * 14.0);
          a *= uLife * (0.5 + flow * 0.5 + head * 2.2);
          col = mix(col, vec3(1.0, 0.97, 0.92), head * 0.8);`,
      },
    })
    const mesh = glowLines(geo, mat)
    mesh.renderOrder = 35
    mesh.visible = false
    return { mesh, mat, geo }
  }, [])

  const a = useMemo(() => new THREE.Vector3(), [])
  const b = useMemo(() => new THREE.Vector3(), [])
  const c = useMemo(() => new THREE.Vector3(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (fx.target !== last.current) {
      last.current = fx.target
      a.fromArray(fx.targetFrom)
      b.fromArray(fx.targetTo)
      // a quadratic arc, lifted by a quarter of its length: a trajectory, not a laser
      c.lerpVectors(a, b, 0.5).add(q.set(0, a.distanceTo(b) * 0.25, 0))
      const A = geo.getAttribute('aA') as THREE.InstancedBufferAttribute
      const B = geo.getAttribute('aB') as THREE.InstancedBufferAttribute
      const at = (t: number, out: THREE.Vector3) => out.copy(a).multiplyScalar((1 - t) * (1 - t)).addScaledVector(c, 2 * (1 - t) * t).addScaledVector(b, t * t)
      for (let i = 0; i < N; i++) {
        at(i / N, p)
        at((i + 1) / N, q)
        A.setXYZ(i, p.x, p.y, p.z)
        B.setXYZ(i, q.x, q.y, q.z)
      }
      A.needsUpdate = B.needsUpdate = true
      mat.uniforms.uColor.value.set(fx.targetColor)
    }
    const age = S.time - fx.target
    const on = age >= 0 && age < LIFE
    mesh.visible = on
    if (!on) return
    mat.uniforms.uDraw.value = THREE.MathUtils.smoothstep(age, 0, DRAW)
    mat.uniforms.uLife.value = age < DRAW + 0.25 ? 1 : Math.exp(-(age - DRAW - 0.25) * 2.4)
  })

  return <primitive object={mesh} />
}
