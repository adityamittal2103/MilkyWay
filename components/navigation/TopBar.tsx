'use client'
import { useEffect, useRef } from 'react'
import { useWorld, live } from '@/lib/store'
import { zoneById } from '@/data/zones'
import { audio } from '@/lib/audio'
import { filterById } from '@/lib/filter'
import { Insignia } from '@/components/ui/Insignia'
import { TransitionLink } from './TransitionLink'

/**
 * Minimal top bar: insignia home, a live flight HUD (sector · altitude · velocity), sound,
 * the Board action and the orbit control that opens the constellation navigation.
 */
export function TopBar() {
  const navOpen = useWorld((s) => s.navOpen)
  const sound = useWorld((s) => s.sound)
  const mode = useWorld((s) => s.mode)
  const filter = useWorld((s) => s.filter)
  const filterOpen = useWorld((s) => s.filterOpen)
  const filterDef = filterById(filter)
  const alt = useRef<HTMLElement>(null)
  const vel = useRef<HTMLElement>(null)
  const sec = useRef<HTMLElement>(null)

  useEffect(() => {
    let raf = 0
    let lastSec = ''
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (alt.current) alt.current.textContent = Math.max(0, Math.round(live.alt * 10)).toLocaleString('en-IN').padStart(5, '0')
      if (vel.current) vel.current.textContent = (live.speed * 0.99).toFixed(2)
      const st = useWorld.getState()
      const z = zoneById(st.hoveredZone ?? st.selectedZone)
      const s = z ? `${z.code} ${z.name}` : '—'
      if (sec.current && s !== lastSec) {
        sec.current.textContent = s
        lastSec = s
      }
      audio.tick(live.speed, performance.now() / 1000)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggleSound = () => {
    const on = !useWorld.getState().sound
    useWorld.getState().set({ sound: on })
    if (on) audio.start()
    else audio.stop()
    try {
      localStorage.setItem('mw-sound', on ? '1' : '0')
    } catch {}
  }

  return (
    <header className="bar" data-ui>
      <TransitionLink href="/" label="The Journey" className="bar__home" aria-label="Milky Way, home" cursor="target">
        <Insignia />
        <span className="bar__word">Milky Way</span>
      </TransitionLink>

      <div className="bar__hud mono" aria-hidden="true">
        <span>
          SEC <b ref={sec}>—</b>
        </span>
        <span>
          ALT <b ref={alt}>00000</b>
        </span>
        <span>
          V <b ref={vel}>0.00</b>c
        </span>
      </div>

      <div className="bar__right">
        <button type="button" className="bar__sound mono" aria-pressed={sound} onClick={toggleSound} data-cursor="target">
          <span className="bar__sound-wave" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="bar__sound-label">{sound ? 'Sound on' : 'Sound off'}</span>
          <span className="sr-only">{sound ? ': turn off ambient sound' : ': turn on ambient sound'}</span>
        </button>
        <button
          type="button"
          className={`bar__filter mono${filter !== 'all' ? ' is-active' : ''}`}
          aria-haspopup="dialog"
          aria-expanded={filterOpen}
          aria-label={filter === 'all' ? 'Filter the festival' : `Filter: ${filterDef.label}`}
          onClick={() => useWorld.getState().set({ filterOpen: !filterOpen, navOpen: false })}
          data-cursor="target"
          style={{ ['--accent' as string]: filterDef.accent }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" />
            <circle cx="10" cy="10" r="4" fill="none" stroke="currentColor" opacity="0.6" />
            <circle cx="10" cy="2" r="1.8" fill="var(--accent)" />
          </svg>
          <span className="bar__filter-label">{filter === 'all' ? 'Filter' : filterDef.label}</span>
        </button>
        {mode !== 'explore' && (
          <TransitionLink href="/explore" label="Explore the Milky Way" className="bar__explore mono" cursor="enter" data-cursor-label="EXPLORE">
            Explore
          </TransitionLink>
        )}
        {mode !== 'register' && (
          <TransitionLink href="/register" label="Board the Milky Way" className="board" cursor="pulse" data-cursor-label="BOARD">
            <span className="board__flame" aria-hidden="true" />
            Board
          </TransitionLink>
        )}
        <button
          type="button"
          className="bar__nav"
          aria-expanded={navOpen}
          aria-controls="constellation-nav"
          aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
          onClick={() => useWorld.getState().set({ navOpen: !navOpen })}
          data-cursor="target"
        >
          <svg className="orbit-icon" viewBox="0 0 28 28" aria-hidden="true">
            <ellipse className="o1" cx="14" cy="14" rx="12" ry="5" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <ellipse className="o2" cx="14" cy="14" rx="12" ry="5" fill="none" stroke="currentColor" strokeWidth="1.3" transform="rotate(60 14 14)" />
            <circle cx="26" cy="14" r="1.8" fill="var(--flare)" />
          </svg>
        </button>
      </div>
    </header>
  )
}
