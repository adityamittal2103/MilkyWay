import { NextResponse } from 'next/server'
import { FESTIVAL } from '@/data/festival'
import { passId, validate, type Registration } from '@/lib/registration'
import { saveParticipant, storageConfigured } from '@/lib/participants'

/**
 * Boarding endpoint.
 *  status 'open'    → stores the participant in Supabase (lib/participants.ts) and confirms.
 *                     REGISTRATION_WEBHOOK_URL, if set, also receives a copy (Sheets/Zapier/CRM).
 *  status 'preview' → validates and returns a clearly labelled PREVIEW pass; nothing is stored.
 *  status 'closed'  → refuses.
 * Without storage configured, an 'open' site refuses honestly (503) rather than pretending.
 */
export async function POST(req: Request) {
  let body: Partial<Registration> & { website?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
  }
  const errors = validate(body)
  if (Object.keys(errors).length) return NextResponse.json({ ok: false, errors }, { status: 422 })

  const status = FESTIVAL.registration.status
  if (status === 'closed') return NextResponse.json({ ok: false, error: 'Boarding is closed.' }, { status: 403 })

  const id = passId(body.email!)
  // the honeypot: a field humans never see. Bots that fill it get a normal-looking answer, nothing is stored.
  if (body.website) return NextResponse.json({ ok: true, mode: 'confirmed', passId: id })

  const clip = (s: string | undefined, n: number) => (s ?? '').trim().slice(0, n)
  const row = {
    pass_id: id,
    name: clip(body.name, 120),
    email: clip(body.email, 254).toLowerCase(),
    phone: clip(body.phone, 20),
    institution: clip(body.institution, 160),
    year: clip(body.year, 20),
    city: clip(body.city, 80),
    interests: (body.interests ?? []).filter((x) => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 32)),
    updates: !!body.updates,
    conduct: !!body.conduct,
    source: 'web',
  }

  if (status === 'preview') return NextResponse.json({ ok: true, mode: 'preview', passId: id })

  if (!storageConfigured()) return NextResponse.json({ ok: false, error: 'The registration desk is not connected yet. Please try again later.' }, { status: 503 })
  const saved = await saveParticipant(row)
  if (!saved.ok) {
    console.error('register: store failed', saved.status, saved.detail)
    return NextResponse.json({ ok: false, error: 'Could not reach the registration desk. Try again.' }, { status: 502 })
  }

  const hook = process.env.REGISTRATION_WEBHOOK_URL
  if (hook) await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...row, at: new Date().toISOString() }) }).catch(() => null)

  return NextResponse.json({ ok: true, mode: 'confirmed', passId: id })
}
