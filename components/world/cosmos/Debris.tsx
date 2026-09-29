'use client'
import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useWorld } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { mulberry32 } from '@/lib/galaxy'
import { SUN_DIR } from '@/lib/universe'
import { U, budget } from '../system'

/**
 * Space debris: a loose asteroid belt between Yashobhoomi and its planets, plus a trail of
 * fragments along the approach. One instanced draw call; tumbling happens in the vertex shader,
 * so there is zero per-frame CPU cost.
 */
const vert = /* glsl */ `
  attribute vec4 aSpin; // axis xyz, speed
  uniform float uTime;
  varying vec3 vN; varying vec3 vWorld;
  vec3 rotate(vec3 v, vec3 k, float a) { return v * cos(a) + cross(k, v) * sin(a) + k * dot(k, v) * (1.0 - cos(a)); }
  void main() {
    vec3 k = normalize(aSpin.xyz);
    float a = uTime * aSpin.w;
    vec3 p = rotate(position, k, a);
    vec3 n = rotate(normal, k, a);
    vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vWorld = w.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const frag = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uAccent;
  varying vec3 vN; varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vN);
    vec3 V = normalize(cameraPosition - vWorld);
    float ndl = max(dot(n, uSun), 0.0);
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    vec3 col = vec3(0.16, 0.15, 0.17) * (0.08 + ndl) + uAccent * rim * 0.25;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

export function Debris() {
  const tier = useWorld((s) => s.bootTier)
  const n = QUALITY[tier].debris
  const mesh = useMemo(() => {
    const rnd = mulberry32(3)
    const geo = new THREE.IcosahedronGeometry(1, 1)
    const pos = geo.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const s = 0.7 + rnd() * 0.5
      pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s * 0.8, pos.getZ(i) * s)
    }
    geo.computeVertexNormals()
    const spin = new Float32Array(n * 4)
    const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uTime: U.uTime, uSun: { value: SUN_DIR }, uAccent: U.uAccent } })
    const im = new THREE.InstancedMesh(geo, mat, n)
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < n; i++) {
      let x: number
      let y: number
      let z: number
      let s: number
      if (i < n * 0.8) {
        // the belt: r 2300–3400, thin and slightly tilted
        const a = rnd() * Math.PI * 2
        const r = 2300 + rnd() * 1100
        x = Math.cos(a) * r
        z = Math.sin(a) * r
        y = (rnd() - 0.5) * 160 + x * 0.06
        s = 4 + Math.pow(rnd(), 3) * 40
      } else {
        // the approach trail: fragments you fly past on the way in
        const t = rnd()
        x = -3000 * t + (rnd() - 0.5) * 900
        y = 1800 * t + (rnd() - 0.5) * 500
        z = 4200 * t + (rnd() - 0.5) * 900
        s = 3 + rnd() * 16
      }
      e.set(rnd() * 6, rnd() * 6, rnd() * 6)
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * (0.6 + rnd() * 0.5), s))
      im.setMatrixAt(i, m)
      spin.set([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5, (rnd() - 0.5) * 0.6], i * 4)
    }
    geo.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 4))
    im.frustumCulled = false
    return im
  }, [n])
  useFrame(() => {
    mesh.count = Math.min(n, budget('debris'))
  })
  return <primitive object={mesh} />
}
