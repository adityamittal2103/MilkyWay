/**
 * The whole motion engine the site needs outside the 3D loop: tween one numeric property of an
 * object with an ease, and cancel it. (Replaced GSAP: 27 KB gzip for two numbers wasn't worth it.)
 */
export const EASE = {
  none: (t: number) => t,
  power2Out: (t: number) => 1 - (1 - t) * (1 - t),
  power3In: (t: number) => t * t * t,
  expoOut: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
}

type Tween = { cancel: () => void }
const running = new Map<object, Map<string, number>>()

export function tween<T extends object>(
  target: T,
  key: keyof T & string,
  to: number,
  duration: number,
  ease: (t: number) => number = EASE.none,
  opts: { delay?: number; onUpdate?: () => void; onComplete?: () => void } = {},
): Tween {
  cancelTween(target, key)
  const from = target[key] as unknown as number
  const start = performance.now() + (opts.delay ?? 0) * 1000
  const ms = Math.max(1, duration * 1000)
  let id = 0
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / ms))
    ;(target as Record<string, number>)[key] = from + (to - from) * ease(t)
    opts.onUpdate?.()
    if (t < 1) {
      id = requestAnimationFrame(step)
      running.get(target)?.set(key, id)
    } else {
      running.get(target)?.delete(key)
      opts.onComplete?.()
    }
  }
  id = requestAnimationFrame(step)
  if (!running.has(target)) running.set(target, new Map())
  running.get(target)!.set(key, id)
  return { cancel: () => cancelTween(target, key) }
}

export function cancelTween(target: object, key: string) {
  const m = running.get(target)
  const id = m?.get(key)
  if (id !== undefined) {
    cancelAnimationFrame(id)
    m!.delete(key)
  }
}
