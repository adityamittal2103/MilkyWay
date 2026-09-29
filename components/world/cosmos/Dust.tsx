'use client'
import { useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useWorld } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { S, U, budget } from '../system'

/**
 * LAYER 3: near-field motes in a box that wraps around the camera. Strong parallax makes every
 * camera move feel physical. They thin out inside the venue ("entering the venue, ambient
 * particles reduce") and take a tint from the active filter.
 */
const BOX = 70
const vert = /* glsl */ `
  attribute vec2 aData;
  uniform vec3 uCam; uniform float uDpr; uniform float uTime; uniform float uAmt;
  varying float vA;
  void main() {
    vec3 drift = vec3(sin(uTime * 0.07 + aData.y * 30.0), cos(uTime * 0.05 + aData.y * 20.0), 0.0) * 3.0;
    vec3 rel = mod(position + drift - uCam + ${BOX.toFixed(1)}, ${(BOX * 2).toFixed(1)}) - ${BOX.toFixed(1)};
    vec4 mv = viewMatrix * vec4(uCam + rel, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    float px = clamp((0.6 + aData.x * 1.8) * uDpr * 26.0 / max(d, 1.0), 0.0, 5.0 * uDpr);
    vA = uAmt * smoothstep(${BOX.toFixed(1)}, ${(BOX * 0.5).toFixed(1)}, length(rel)) * smoothstep(3.0, 9.0, d) * (0.4 + 0.6 * aData.x);
    float m = 3.0; // physical px: below this a point's coverage (1–4 px) jumps as it moves
    if (px < m) { vA *= pow(px / m, 1.5); px = m; }
    gl_PointSize = px;
  }
`
const frag = /* glsl */ `
  uniform vec3 uAccent; uniform float uFilterAmt;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.1, d) * vA;
    vec3 c = mix(vec3(0.85, 0.9, 1.0), uAccent, uFilterAmt * 0.6);
    gl_FragColor = vec4(c * a, a);
    #include <colorspace_fragment>
  }
`

export function Dust() {
  const tier = useWorld((s) => s.bootTier)
  const n = QUALITY[tier].dust
  const amt = useMemo(() => ({ value: 1 }), [])
  const cam = useMemo(() => ({ value: new THREE.Vector3() }), [])
  const { geo, mat } = useMemo(() => {
    const p = new Float32Array(n * 3)
    const d = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      p.set([(Math.random() * 2 - 1) * BOX, (Math.random() * 2 - 1) * BOX, (Math.random() * 2 - 1) * BOX], i * 3)
      d.set([Math.random(), Math.random()], i * 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    g.setAttribute('aData', new THREE.BufferAttribute(d, 2))
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uCam: cam, uDpr: U.uDpr, uTime: U.uTime, uAmt: amt, uAccent: U.uAccent, uFilterAmt: U.uFilterAmt },
    })
    return { geo: g, mat: m }
  }, [n, amt, cam])
  useFrame(({ camera }) => {
    cam.value.copy(camera.position)
    amt.value = 0.55 * S.dust * (1 + U.uFlash.value * 1.2)
    geo.setDrawRange(0, Math.min(n, budget('dust')))
  })
  return <points geometry={geo} material={mat} frustumCulled={false} />
}
