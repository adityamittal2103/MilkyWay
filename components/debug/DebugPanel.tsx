'use client'
import { useEffect, useRef, useState } from 'react'
import { DEBUG_FLAGS, stats, useDebug } from '@/lib/debug'
import { live, useWorld } from '@/lib/store'

/**
 * The flicker diagnostic panel (`?debug`). A lazy chunk: never downloaded without the flag.
 * Readouts refresh 4×/s into a <pre> (no React renders per frame).
 */
const css = `
.dbg{position:fixed;left:12px;bottom:12px;z-index:9999;font:11px/1.45 ui-monospace,Menlo,monospace;color:#cfe0ff;
background:rgb(2 3 10/.88);border:1px solid rgb(207 224 255/.18);padding:10px 12px;width:268px;pointer-events:auto;backdrop-filter:blur(6px)}
.dbg pre{margin:0 0 8px;white-space:pre-wrap}
.dbg b{color:#fff4e0;font-weight:600}
.dbg__flags{display:grid;gap:3px}
.dbg__flag{all:unset;cursor:pointer;display:flex;gap:8px;align-items:center;color:#8b90a6}
.dbg__flag i{width:9px;height:9px;border:1px solid currentColor;flex:none}
.dbg__flag.is-on{color:#c6ff3d}.dbg__flag.is-on i{background:currentColor}
.dbg__head{all:unset;cursor:pointer;display:block;margin-bottom:6px;color:#fff4e0;letter-spacing:.12em}
html.dbg-nolabels .labels{display:none!important}
`

export default function DebugPanel() {
  const flags = useDebug((s) => s.flags)
  const toggle = useDebug((s) => s.toggle)
  const [open, setOpen] = useState(true)
  const pre = useRef<HTMLPreElement>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dbg-nolabels', flags.nolabels)
  }, [flags.nolabels])

  useEffect(() => {
    const id = setInterval(() => {
      if (!pre.current) return
      const w = useWorld.getState()
      const nav = w.nav.kind + ('id' in w.nav ? `:${w.nav.id}` : '')
      pre.current.textContent = [
        `FPS        ${stats.fps.toFixed(0).padStart(4)}   worst ${stats.worstMs.toFixed(1)} ms`,
        `DPR        ${stats.dpr.toFixed(2)}`,
        `QUALITY    ${w.tier} (boot ${w.bootTier})${w.tierLocked ? ' · locked' : ''}`,
        `GOVERNOR   ${live.quality.state}${live.quality.reason ? ' · ' + live.quality.reason : ''}`,
        `DRAW CALLS ${stats.calls}   programs ${stats.programs}`,
        `TRIANGLES  ${stats.triangles.toLocaleString()}   points ${stats.points.toLocaleString()}`,
        `CAMERA     ${live.camState}   ${live.camView}`,
        `WORLD      ${w.mode} · ${nav}${w.introDone ? '' : ' · intro'}`,
        `TRANSITION ${w.transition.active ? 'active → ' + w.transition.href : 'none'}   warp ${live.warp.toFixed(2)}`,
        `FLIGHT     ${live.flight > 0.01 ? 'active ' + live.flight.toFixed(2) : 'none'}   pilot ${live.pilot.speed.toFixed(2)}`,
        `POST       ${stats.post ? 'enabled' : 'disabled'}`,
      ].join('\n')
    }, 250)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="dbg" data-ui aria-hidden="true">
      <style>{css}</style>
      <button type="button" className="dbg__head" onClick={() => setOpen((o) => !o)}>
        FLICKER DIAGNOSTICS {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <pre ref={pre} />
          <div className="dbg__flags">
            {DEBUG_FLAGS.map((f) => (
              <button key={f.id} type="button" className={`dbg__flag${flags[f.id] ? ' is-on' : ''}`} onClick={() => toggle(f.id)}>
                <i />
                {f.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
