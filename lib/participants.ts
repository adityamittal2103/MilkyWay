/**
 * PARTICIPANTS (server only). Registrations are stored in Supabase, table `public.registrations`
 * (schema: supabase/migrations). This file is imported only by app/api/register/route.ts, so the
 * secret key never reaches a browser bundle.
 *
 * Env (Vercel → Project → Settings → Environment Variables, and .env.local for development):
 *   SUPABASE_URL                 https://<project-ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY    the project's secret key (sb_secret_…, or the legacy service_role JWT)
 *
 * The table has row-level security on and no public policies: nobody can read or write it with a
 * browser key. Only this server code (secret key) inserts, and organisers read it in the Supabase
 * dashboard (Table Editor → registrations, with CSV export).
 */
export type ParticipantRow = {
  pass_id: string
  name: string
  email: string
  phone: string
  institution: string
  year: string
  city: string
  interests: string[]
  updates: boolean
  conduct: boolean
  source: string
}

export const storageConfigured = () => !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

/**
 * Insert, or update the existing row for the same email (registering twice never duplicates a
 * participant; the pass id is derived from the email, so it stays the same).
 */
export async function saveParticipant(row: ParticipantRow): Promise<{ ok: true } | { ok: false; status: number; detail: string }> {
  const base = process.env.SUPABASE_URL!.replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const headers: Record<string, string> = {
    apikey: key,
    'content-type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal',
  }
  // legacy keys are JWTs and also go in Authorization; new sb_secret_ keys are sent as apikey only
  if (key.startsWith('ey')) headers.Authorization = `Bearer ${key}`
  try {
    const r = await fetch(`${base}/rest/v1/registrations?on_conflict=email`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...row, updated_at: new Date().toISOString() }),
      cache: 'no-store',
    })
    if (r.ok) return { ok: true }
    return { ok: false, status: r.status, detail: (await r.text()).slice(0, 300) }
  } catch (e) {
    return { ok: false, status: 0, detail: String(e).slice(0, 300) }
  }
}
