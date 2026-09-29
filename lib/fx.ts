/**
 * WORLD REACTIONS. Moments the whole universe answers, each a timestamp on the world clock
 * (S.time), so every system derives the same envelope and nothing needs React:
 *
 *   filter  a colour field propagates: pulse from the hall, sectors heat, markers pulse, planets
 *           flare, local stars brighten, then everything settles (≈ 0.9 s)
 *   planet  selecting a world: pulse, its orbit lights, a burst, local stars brighten
 *   target  selecting an event / sector / world: an energy path draws from the ship to it
 *   land    touchdown: shockwave + dust burst + the venue lights surge
 *   sky     a constellation discovered: stars brighten, lines draw, the nebulae answer
 */
export const fx = {
  filter: -10,
  filterColor: '#6A5CFF',
  planet: -10,
  target: -10,
  targetFrom: [0, 0, 0] as [number, number, number],
  targetTo: [0, 0, 0] as [number, number, number],
  targetColor: '#3FE0FF',
  land: -10,
  sky: -10,
}

/** attack–decay envelope: 0 → 1 in `attack` s, back to 0 over `decay` s */
export const envelope = (now: number, t0: number, attack = 0.08, decay = 0.9) => {
  const t = now - t0
  if (t < 0 || t > attack + decay) return 0
  return t < attack ? t / attack : Math.exp(-((t - attack) / decay) * 3.2) * (1 - (t - attack) / decay) + 0
}
