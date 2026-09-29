'use client'
import { useRef, useState } from 'react'
import { CATEGORIES } from '@/data/categories'
import { FESTIVAL } from '@/data/festival'
import { YEARS, validate, type Registration } from '@/lib/registration'
import { audio } from '@/lib/audio'
import { BoardingPass } from './BoardingPass'

const EMPTY: Registration = { name: '', email: '', phone: '', institution: '', year: '', city: '', interests: [], conduct: false, updates: true }

/**
 * WOW 08, boarding. The theatre is the pass (it builds itself as you type and prints on
 * submit); the form itself is deliberately plain: labelled fields, inline errors, one button.
 */
export function RegisterUI() {
  const [f, setF] = useState<Registration>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof Registration, string>>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ passId: string; mode: 'preview' | 'confirmed' } | null>(null)
  const [msg, setMsg] = useState('')
  const passRef = useRef<HTMLDivElement>(null)
  const status = FESTIVAL.registration.status

  const upd = <K extends keyof Registration>(k: K, v: Registration[K]) => {
    setF((p) => ({ ...p, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate(f)
    setErrors(errs)
    if (Object.keys(errs).length) {
      const first = Object.keys(errs)[0]
      document.getElementById(`f-${first}`)?.focus()
      return
    }
    setState('sending')
    setMsg('')
    try {
      const website = (document.getElementById('f-website') as HTMLInputElement | null)?.value ?? ''
      const r = await fetch('/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, website }) })
      const j = await r.json()
      if (!r.ok || !j.ok) {
        if (j.errors) setErrors(j.errors)
        setMsg(j.error ?? 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setResult({ passId: j.passId, mode: j.mode })
      setState('done')
      audio.ping(1.5)
      passRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      setMsg('Could not reach the registration desk. Check your connection and try again.')
      setState('error')
    }
  }

  const savePass = async () => {
    // draw the pass to a canvas → PNG (no dependency)
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 520
    const g = c.getContext('2d')!
    g.fillStyle = '#0A0F1F'
    g.fillRect(0, 0, 1200, 520)
    g.strokeStyle = 'rgba(241,237,228,0.3)'
    g.strokeRect(20, 20, 1160, 480)
    g.fillStyle = '#FF7A1A'
    g.fillRect(20, 20, 1160, 6)
    g.fillStyle = '#F1EDE4'
    g.font = '800 64px Anybody, sans-serif'
    g.fillText('MILKY WAY', 60, 120)
    g.font = '500 20px "IBM Plex Mono", monospace'
    g.fillStyle = '#8B90A6'
    g.fillText(`${FESTIVAL.organiser.toUpperCase()} · BOARDING PASS · ${FESTIVAL.venue.name.toUpperCase()}`, 60, 160)
    g.fillStyle = '#F1EDE4'
    g.font = '700 48px "Instrument Sans", sans-serif'
    g.fillText(f.name, 60, 270)
    g.font = '400 26px "Instrument Sans", sans-serif'
    g.fillText(f.institution, 60, 316)
    g.font = '500 22px "IBM Plex Mono", monospace'
    g.fillText(`PASS ${result?.passId}`, 60, 420)
    g.fillStyle = result?.mode === 'confirmed' ? '#5B8CFF' : '#FFB38A'
    g.fillText(result?.mode === 'confirmed' ? 'CLEARED FOR BOARDING' : 'PREVIEW PASS · NOT A CONFIRMED SEAT', 60, 460)
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `milky-way-pass-${result?.passId}.png`
    a.click()
  }

  const field = (k: keyof Registration) => ({
    id: `f-${k}`,
    'aria-invalid': !!errors[k] || undefined,
    'aria-describedby': errors[k] ? `e-${k}` : undefined,
  })
  const err = (k: keyof Registration) =>
    errors[k] ? (
      <span className="field__err mono" id={`e-${k}`} role="alert">
        {errors[k]}
      </span>
    ) : null

  if (status === 'closed') {
    return (
      <div className="register" data-ui>
        <h1 className="title title--hero">Boarding closed</h1>
        <p className="lead">This flight has left. See you next orbit.</p>
      </div>
    )
  }

  return (
    <div className="register" data-ui>
      <header className="register__head">
        <p className="ch__index mono">
          <span>06</span> Register · Gate S-01 Docking Bay
        </p>
        <h1 className="title title--hero">Board the Milky Way</h1>
        <p className="lead">Under a minute. Your pass prints at the gate.</p>
        {status === 'preview' && (
          <p className="provisional">Preview mode: passes are issued for testing and no seat is reserved yet</p>
        )}
        {FESTIVAL.registration.externalUrl && (
          <a className="go go--ion" href={FESTIVAL.registration.externalUrl}>
            Official registration form <span className="go__arrow">↗</span>
          </a>
        )}
      </header>

      <div className="register__grid">
        <form className="form" onSubmit={submit} noValidate aria-describedby="form-note">
          <div className="field">
            <label htmlFor="f-name">Full name</label>
            <input {...field('name')} autoComplete="name" value={f.name} onChange={(e) => upd('name', e.target.value)} required />
            {err('name')}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-email">Email</label>
              <input {...field('email')} type="email" autoComplete="email" inputMode="email" value={f.email} onChange={(e) => upd('email', e.target.value)} required />
              {err('email')}
            </div>
            <div className="field">
              <label htmlFor="f-phone">Mobile</label>
              <input {...field('phone')} type="tel" autoComplete="tel" inputMode="tel" placeholder="+91" value={f.phone} onChange={(e) => upd('phone', e.target.value)} required />
              {err('phone')}
            </div>
          </div>
          <div className="field">
            <label htmlFor="f-institution">College / institution</label>
            <input {...field('institution')} autoComplete="organization" value={f.institution} onChange={(e) => upd('institution', e.target.value)} required />
            {err('institution')}
          </div>
          <div className="field-row">
            <div className="field">
              <label htmlFor="f-year">Year of study</label>
              <select {...field('year')} value={f.year} onChange={(e) => upd('year', e.target.value)} required>
                <option value="">Select</option>
                {YEARS.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              {err('year')}
            </div>
            <div className="field">
              <label htmlFor="f-city">City <span className="dust">(optional)</span></label>
              <input id="f-city" autoComplete="address-level2" value={f.city} onChange={(e) => upd('city', e.target.value)} />
            </div>
          </div>
          <fieldset className="field">
            <legend>Orbits you&apos;re into <span className="dust">(optional)</span></legend>
            <div className="chips">
              {CATEGORIES.map((c) => {
                const on = f.interests.includes(c.id)
                return (
                  <label key={c.id} className={`chip${on ? ' is-on' : ''}`} style={{ ['--accent' as string]: c.accent }}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => upd('interests', on ? f.interests.filter((x) => x !== c.id) : [...f.interests, c.id])}
                    />
                    {c.name}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="field field--check">
            <label>
              <input {...field('conduct')} type="checkbox" checked={f.conduct} onChange={(e) => upd('conduct', e.target.checked)} required />
              I&apos;ll follow the festival code of conduct.
            </label>
            {err('conduct')}
          </div>
          <div className="field field--check">
            <label>
              <input type="checkbox" checked={f.updates} onChange={(e) => upd('updates', e.target.checked)} />
              Send me transmissions: line-up, dates, event registrations.
            </label>
          </div>
          {/* spam trap: invisible to people and screen readers, irresistible to form bots */}
          <div className="form__trap" aria-hidden="true">
            <label htmlFor="f-website">Website</label>
            <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <p id="form-note" className="mono dust form__note">
            We use these details only for Milky Way registration and updates.
          </p>
          <button type="submit" className="board board--lg" disabled={state === 'sending'} data-cursor="register" data-cursor-label="BOARD">
            <span className="board__flame" aria-hidden="true" />
            {state === 'sending' ? 'Boarding…' : state === 'done' ? 'Boarded ✓' : 'Board now'}
          </button>
          <p className="form__status" role="status" aria-live="polite">
            {state === 'error' && <span className="field__err">{msg}</span>}
            {state === 'done' && result && (
              <span>
                {result.mode === 'confirmed'
                  ? `You're on board. Pass ${result.passId}.`
                  : `Preview pass ${result.passId} issued. Registration isn't live yet, so no seat has been reserved.`}
              </span>
            )}
          </p>
        </form>

        <div className={`register__pass${state === 'done' ? ' is-printed' : ''}`}>
          <BoardingPass
            ref={passRef}
            name={f.name}
            institution={f.institution}
            interests={f.interests}
            passId={result?.passId ?? null}
            mode={state === 'done' && result ? result.mode : 'draft'}
          />
          {state === 'done' && (
            <button type="button" className="go go--ion" onClick={savePass} data-cursor="target">
              Save pass as image <span className="go__arrow">↓</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
