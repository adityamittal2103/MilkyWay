/** Shared validation for the boarding form (runs on client and server). */
export type Registration = {
  name: string
  email: string
  phone: string
  institution: string
  year: string
  city: string
  interests: string[]
  conduct: boolean
  updates: boolean
}

export const YEARS = ['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Other'] as const

export function validate(r: Partial<Registration>) {
  const e: Partial<Record<keyof Registration, string>> = {}
  if (!r.name || r.name.trim().length < 2) e.name = 'Enter your full name.'
  if (!r.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email)) e.email = 'Enter a valid email address.'
  const digits = (r.phone ?? '').replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 13) e.phone = 'Enter a 10-digit mobile number.'
  if (!r.institution || r.institution.trim().length < 2) e.institution = 'Enter your college or institution.'
  if (!r.year) e.year = 'Select your year of study.'
  if (!r.conduct) e.conduct = 'Please accept the code of conduct to board.'
  return e
}

export function passId(email: string) {
  let h = 2166136261
  for (const ch of email.toLowerCase()) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return 'MW-' + (h >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7)
}
