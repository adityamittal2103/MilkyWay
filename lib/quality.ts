import type { Tier } from './constants'

/**
 * Pick a starting quality tier from what the device tells us. The QualityGovernor in the canvas
 * can still step the budget down at runtime (never up past the boot tier).
 * `?quality=low|medium|high|ultra` locks it for testing.
 */
type Caps = { webgl: boolean; tier: Tier; bootTier: Tier; tierLocked: boolean; coarse: boolean; reducedMotion: boolean }

export function detectCapabilities(): Caps {
  const c = detect()
  return { ...c, bootTier: c.tier }
}

function detect(): Omit<Caps, 'bootTier'> {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const override = new URLSearchParams(location.search).get('quality') as Tier | null

  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null
  try {
    const c = document.createElement('canvas')
    gl = c.getContext('webgl2') || c.getContext('webgl')
  } catch {
    gl = null
  }
  if (!gl || new URLSearchParams(location.search).has('nowebgl')) return { webgl: false, tier: 'low', tierLocked: true, coarse, reducedMotion }

  let renderer = ''
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
  gl.getExtension('WEBGL_lose_context')?.loseContext()

  if (override && ['low', 'medium', 'high', 'ultra'].includes(override)) return { webgl: true, tier: override, tierLocked: true, coarse, reducedMotion }

  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const mem = nav.deviceMemory ?? 8
  const cores = navigator.hardwareConcurrency ?? 8
  const small = Math.min(screen.width, screen.height) < 500
  const saveData = nav.connection?.saveData === true
  const software = /swiftshader|llvmpipe|software/i.test(renderer)
  const integrated = /intel|mali-4|adreno \(tm\) [3-5]\d\d|powervr/i.test(renderer)

  const discrete = /rtx|radeon rx [5-9]\d{3}|radeon pro|apple m[1-9] (pro|max|ultra)|apple m[3-9]/i.test(renderer)

  let tier: Tier = 'high'
  if (software || saveData || mem <= 2) tier = 'low'
  else if (coarse && small) tier = mem >= 6 && cores >= 6 ? 'medium' : 'low'
  else if (coarse || integrated || mem <= 4 || cores <= 4) tier = 'medium'
  else if (discrete && cores >= 8) tier = 'ultra'
  return { webgl: true, tier, tierLocked: false, coarse, reducedMotion }
}
