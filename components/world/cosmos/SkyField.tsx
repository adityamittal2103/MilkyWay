'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { GALAXY_NORMAL } from '@/lib/universe'
import { mulberry32 } from '@/lib/galaxy'
import { NOISE_GLSL, S } from '../system'

/**
 * LAYER 1, the far background. An infinitely distant sphere that follows the camera:
 * deep-space black with very faint colour fields, the glow of the galactic band when you are
 * inside the disc, and a handful of distant galaxies as tiny tilted smudges.
 */
const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pin to the far plane
  }
`
const skyFrag = /* glsl */ `
  ${NOISE_GLSL}
  uniform vec3 uNormal; uniform float uInside; uniform float uTime;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float n = fbm3(d * 2.4 + vec3(3.1, 0.0, 0.0), 4);
    float m = fbm3(d * 5.0 + vec3(0.0, 9.7, 1.3), 3);
    // linear values: sRGB output lifts darks a lot, so these stay deliberately tiny
    vec3 blue = vec3(0.0035, 0.007, 0.022);
    vec3 violet = vec3(0.009, 0.003, 0.016);
    vec3 teal = vec3(0.002, 0.011, 0.012);
    vec3 col = vec3(0.0009, 0.0011, 0.0028);
    col += blue * smoothstep(0.45, 0.8, n);
    col += violet * smoothstep(0.5, 0.85, m) * 0.9;
    col += teal * smoothstep(0.62, 0.9, n * m * 1.6);
    // the galactic band, seen from inside the disc
    float b = abs(dot(d, uNormal));
    float band = exp(-b * b / 0.018) * (0.35 + 0.65 * fbm3(d * 9.0, 4));
    float lane = smoothstep(0.02, 0.0, abs(dot(d, uNormal) - 0.01 + (m - 0.5) * 0.03)) * 0.5;
    col += vec3(0.016, 0.016, 0.022) * band * uInside * (1.0 - lane);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`
const farGalVert = /* glsl */ `
  attribute vec4 aShape; // angle, axis ratio, size px, brightness
  uniform float uDpr;
  varying vec4 vShape;
  void main() {
    vShape = aShape;
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
    gl_PointSize = aShape.z * uDpr;
  }
`
const farGalFrag = /* glsl */ `
  varying vec4 vShape;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = vShape.x;
    c = mat2(cos(a), -sin(a), sin(a), cos(a)) * c;
    c.y /= vShape.y;
    float r = length(c);
    float l = (exp(-r * r * 60.0) + exp(-r * 18.0) * 0.25) * vShape.w;
    vec3 col = mix(vec3(0.75, 0.8, 1.0), vec3(1.0, 0.85, 0.7), step(0.5, fract(vShape.x * 3.0)));
    gl_FragColor = vec4(col * l, l);
    #include <colorspace_fragment>
  }
`

export function SkyField() {
  const g = useRef<THREE.Group>(null)
  const inside = useMemo(() => ({ value: 1 }), [])
  const uDpr = useMemo(() => ({ value: 1 }), [])
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uNormal: { value: GALAXY_NORMAL }, uInside: inside, uTime: { value: 0 } },
      }),
    [inside],
  )
  const far = useMemo(() => {
    const rnd = mulberry32(99)
    const n = 14
    const pos = new Float32Array(n * 3)
    const shape = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1
      const th = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      pos.set([s * Math.cos(th) * 1000, u * 1000, s * Math.sin(th) * 1000], i * 3)
      shape.set([rnd() * Math.PI, 0.25 + rnd() * 0.5, 10 + rnd() * 18, 0.25 + rnd() * 0.35], i * 4)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aShape', new THREE.BufferAttribute(shape, 4))
    const mat = new THREE.ShaderMaterial({ vertexShader: farGalVert, fragmentShader: farGalFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uDpr } })
    return { geo, mat }
  }, [uDpr])

  useFrame(({ camera, viewport }) => {
    if (g.current) g.current.position.copy(camera.position)
    // inside the disc near the station → the band; out in deep space → just colour fields
    inside.value = (1 - THREE.MathUtils.smoothstep(camera.position.length(), 9000, 45000)) * 0.8 + 0.2 * S.galaxy
    uDpr.value = viewport.dpr
  })

  return (
    <group ref={g}>
      <mesh material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[1000, 48, 24]} />
      </mesh>
      <points geometry={far.geo} material={far.mat} renderOrder={-9} frustumCulled={false} />
    </group>
  )
}
