'use client'
import { useEffect } from 'react'
import { useWorld } from '@/lib/store'

/**
 * Hidden details surface here: a small transmission that slides in when you find something
 * (inspect the ship, chart enough of the system). It never blocks and closes on its own.
 */
export const MILESTONES = [
  { at: 5, title: 'Signal strengthening', body: 'Five places charted. The nebulae above Yashobhoomi are brightening; the system is noticing you.' },
  { at: 12, title: 'Cartographer', body: 'Twelve places charted. The galactic core burns a little hotter from here.' },
  { at: 21, title: 'The whole map', body: 'Every sector, world and constellation charted. The station rings now carry your colour.' },
]

export function LorePanel() {
  const lore = useWorld((s) => s.lore)
  const discovered = useWorld((s) => s.discovered)

  // milestones: exploring enough changes the galaxy (see system.ts chart channel)
  useEffect(() => {
    const places = discovered.filter((d) => /^(zone|planet|sky):/.test(d)).length
    const m = MILESTONES.filter((x) => places >= x.at).pop()
    if (!m) return
    const key = `milestone:${m.at}`
    if (discovered.includes(key)) return
    const st = useWorld.getState()
    st.discover(key)
    st.set({ lore: { title: m.title, body: m.body } })
  }, [discovered])

  useEffect(() => {
    if (!lore) return
    const t = setTimeout(() => useWorld.getState().set({ lore: null }), 7000)
    return () => clearTimeout(t)
  }, [lore])

  return (
    <div className={`lore${lore ? ' is-on' : ''}`} role="status" aria-live="polite" data-ui>
      {lore && (
        <>
          <p className="lore__kicker mono">Transmission received</p>
          <p className="lore__title">{lore.title}</p>
          <p className="lore__body">{lore.body}</p>
          <button type="button" className="lore__close mono" onClick={() => useWorld.getState().set({ lore: null })} aria-label="Dismiss" data-cursor="target">
            ×
          </button>
        </>
      )}
    </div>
  )
}
