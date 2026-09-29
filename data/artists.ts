import { PROVISIONAL_TRANSMISSIONS } from './provisional/transmissions'

/**
 * TRANSMISSIONS: performers. `ARTISTS` stays empty until the organisers announce the line-up.
 * Each artist arrives as a decryption transmission: the portrait is reconstructed from signal data.
 *
 * To add a confirmed artist:
 *   image   a portrait in /public/artists (a transparent cut-out PNG/WebP gives the cleanest result;
 *           any photo works, the pipeline masks it). Loaded only when their transmission opens.
 *   audio   optional: track, voice note, interview, soundbite, performance excerpt or festival audio
 *           (/public/audio/*.mp3). Without it, a deterministic synthetic signal drives the reveal.
 */
export type Artist = {
  id: string
  name: string
  /** portrait source (see above); `imageKind: 'baked'` is only for the placeholder identities */
  image: string | null
  imageKind?: 'photo' | 'baked'
  audio: string | null
  audioKind?: 'track' | 'voice' | 'interview' | 'soundbite' | 'performance' | 'festival'
  /** → data/categories.ts id: also shapes the synthetic signal (tempo, voice vs beat) */
  genre: string
  /** → PROVISIONAL_DAYS index (festival day) */
  day: number | null
  time: string | null
  /** → data/zones.ts id */
  venue: string
  /** the transmission's two colours: every reveal is tinted by its artist */
  colour: [string, string]
  transmissionSeed: number
  description?: string
  /** → event slug: VIEW PERFORMANCE */
  event?: string
  provisional?: boolean
}

export const ARTISTS: Artist[] = []

/** What the Transmissions network shows: the real line-up, or clearly labelled test transmissions. */
export const TRANSMISSIONS: Artist[] = ARTISTS.length ? ARTISTS : PROVISIONAL_TRANSMISSIONS
export const transmissionById = (id: string | null | undefined) => TRANSMISSIONS.find((a) => a.id === id) ?? null
