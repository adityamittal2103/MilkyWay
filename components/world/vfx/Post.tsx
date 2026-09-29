'use client'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette, ChromaticAberration, SMAA, FXAA } from '@react-three/postprocessing'
import { BlendFunction, Pass, type ChromaticAberrationEffect } from 'postprocessing'
import { useWorld } from '@/lib/store'
import { QUALITY } from '@/lib/constants'
import { S } from '../system'

/**
 * Post-processing is spice. Bloom is thresholded (only engines, emissives, hot stars and energy
 * lines glow), the vignette frames, and chromatic aberration exists only while accelerating.
 *   lite (medium tier): bloom + vignette + FXAA      full (high/ultra): + aberration, wider bloom, SMAA
 *
 * Flicker-safety:
 *  - the pipeline is built ONCE for the boot tier; quality changes never rebuild it
 *  - a sanitise pass runs before bloom: a single NaN/Inf pixel (or a sub-pixel "firefly" that is
 *    absurdly bright) would otherwise smear through the bloom mip chain as a full-frame flash
 *  - antialiasing on every tier that has post (without it, thin geometry crawls as the camera moves):
 *    FXAA on medium (one cheap pass, no start-up cost on phones), SMAA on high/ultra
 */
class SanitizePass extends Pass {
  private mat: THREE.ShaderMaterial
  constructor() {
    super('SanitizePass')
    this.mat = new THREE.ShaderMaterial({
      uniforms: { inputBuffer: { value: null } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D inputBuffer; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(inputBuffer, vUv);
          #if __VERSION__ >= 300
          if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0);
          #endif
          gl_FragColor = clamp(c, 0.0, 24.0);
        }`,
      depthWrite: false,
      depthTest: false,
    })
    this.fullscreenMaterial = this.mat
  }
  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, outputBuffer: THREE.WebGLRenderTarget) {
    this.mat.uniforms.inputBuffer.value = inputBuffer.texture
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }
}

export function Post() {
  const tier = useWorld((s) => s.bootTier)
  const mode = QUALITY[tier].post
  const ca = useRef<ChromaticAberrationEffect>(null)
  const offset = useMemo(() => new THREE.Vector2(0, 0), [])
  const sanitize = useMemo(() => new SanitizePass(), [])

  useFrame(() => {
    if (!ca.current) return
    const k = Math.max(S.warp, S.flight * 0.6, S.hyper * 0.7)
    offset.set(k * 0.0028, k * 0.0012)
    ca.current.offset = offset
  })

  if (mode === 'none') return null
  if (mode === 'lite')
    return (
      <EffectComposer multisampling={0}>
        <primitive object={sanitize} />
        <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.58} luminanceSmoothing={0.22} radius={0.66} resolutionScale={0.5} />
        <Vignette offset={0.28} darkness={0.62} />
        <FXAA />
      </EffectComposer>
    )
  return (
    // MSAA render targets are unreliable across GPUs/drivers (blank output on some); SMAA instead
    <EffectComposer multisampling={0}>
      <primitive object={sanitize} />
      <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.54} luminanceSmoothing={0.24} radius={0.72} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.3} blendFunction={BlendFunction.NORMAL} />
      <Vignette offset={0.26} darkness={0.64} />
      <SMAA />
    </EffectComposer>
  )
}
