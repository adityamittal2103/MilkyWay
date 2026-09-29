/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ PROVISIONAL PROGRAMME: STRUCTURAL PLACEHOLDER, NOT ANNOUNCED CONTENT      │
 * │                                                                          │
 * │ These are common cultural-fest *formats* used to prove the event         │
 * │ universe, schedule orbit and detail pages. None of them is a confirmed    │
 * │ Milky Way event. Every entry has `provisional: true` and the UI labels   │
 * │ it as such. Replace this file (or wire a CMS to the same `Event` shape)  │
 * │ when the organisers publish the programme.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export type EventKind = 'show' | 'competition' | 'workshop' | 'experience'

export type FestEvent = {
  slug: string
  title: string
  category: string // → data/categories.ts
  kind: EventKind
  zone: string // → data/zones.ts
  /** Provisional orbit placement. Day index into PROVISIONAL_DAYS, 24h times */
  day: number
  start: string
  end: string
  format: string
  artists: string[]
  registrationUrl: string | null
  provisional: boolean
}

/** Number of festival days is not yet announced; two orbits are drawn provisionally. */
export const PROVISIONAL_DAYS = [
  { index: 0, label: 'Day 01', date: null as string | null },
  { index: 1, label: 'Day 02', date: null as string | null },
]

const e = (x: Omit<FestEvent, 'artists' | 'registrationUrl' | 'provisional'>): FestEvent => ({
  ...x,
  artists: [],
  registrationUrl: null,
  provisional: true,
})

export const EVENTS: FestEvent[] = [
  // music: Sonic Core
  e({ slug: 'headline-night', title: 'Headline Night', category: 'music', kind: 'show', zone: 'supergiant', day: 1, start: '20:00', end: '23:00', format: 'The main-stage headline set. Line-up on transmission.' }),
  e({ slug: 'battle-of-the-bands', title: 'Battle of the Bands', category: 'music', kind: 'competition', zone: 'supergiant', day: 0, start: '15:00', end: '18:30', format: 'Live band competition on the main stage.' }),
  e({ slug: 'acoustic-orbit', title: 'Acoustic Orbit', category: 'music', kind: 'competition', zone: 'nebula-walk', day: 0, start: '12:00', end: '14:00', format: 'Solo and duet unplugged sets in front of the light curtain.' }),
  e({ slug: 'dj-face-off', title: 'DJ Face-Off', category: 'music', kind: 'competition', zone: 'supergiant', day: 1, start: '17:00', end: '19:30', format: 'Back-to-back DJ battle, crowd-judged.' }),
  // dance: Kinetic Cluster
  e({ slug: 'group-dance', title: 'Group Dance', category: 'dance', kind: 'competition', zone: 'supergiant', day: 1, start: '13:00', end: '16:00', format: 'Crew choreography competition.' }),
  e({ slug: 'street-battle', title: 'Street Dance Battle', category: 'dance', kind: 'competition', zone: 'constellation-hall', day: 0, start: '17:00', end: '19:00', format: 'One-on-one cypher battles, knockout format.' }),
  e({ slug: 'solo-dance', title: 'Solo Dance', category: 'dance', kind: 'competition', zone: 'constellation-hall', day: 1, start: '11:00', end: '13:00', format: 'Solo performance, any style.' }),
  // theatre: Proscenium
  e({ slug: 'nukkad-natak', title: 'Nukkad Natak', category: 'theatre', kind: 'competition', zone: 'outer-orbit', day: 0, start: '11:00', end: '13:30', format: 'Street play competition, performed in the round outside the hall.' }),
  e({ slug: 'one-act-play', title: 'One-Act Play', category: 'theatre', kind: 'competition', zone: 'constellation-hall', day: 1, start: '14:00', end: '16:30', format: 'Short stage plays with minimal sets.' }),
  // fashion: Orbital Runway
  e({ slug: 'orbital-runway', title: 'Orbital Runway', category: 'fashion', kind: 'competition', zone: 'supergiant', day: 0, start: '19:00', end: '21:00', format: 'Themed fashion show competition.' }),
  e({ slug: 'thrift-flip', title: 'Thrift Flip', category: 'fashion', kind: 'workshop', zone: 'event-horizon', day: 1, start: '12:00', end: '14:00', format: 'Upcycle a thrifted piece in two hours.' }),
  // comedy: Laughter Field
  e({ slug: 'stand-up-night', title: 'Stand-Up Night', category: 'comedy', kind: 'show', zone: 'constellation-hall', day: 0, start: '20:00', end: '22:00', format: 'A stand-up comedy show. Line-up on transmission.' }),
  e({ slug: 'open-mic', title: 'Open Mic', category: 'comedy', kind: 'competition', zone: 'zero-g', day: 1, start: '16:00', end: '18:00', format: 'Five minutes, one mic, crowd votes.' }),
  // art: Nebula
  e({ slug: 'live-mural', title: 'Live Mural', category: 'art', kind: 'experience', zone: 'event-horizon', day: 0, start: '11:00', end: '20:00', format: 'A wall that fills up over the day.' }),
  e({ slug: 'deep-space-exhibition', title: 'Deep Space Exhibition', category: 'art', kind: 'experience', zone: 'event-horizon', day: 1, start: '11:00', end: '20:00', format: 'Student work on the theme, hung along the corridor.' }),
  // workshops: The Lab
  e({ slug: 'beat-lab', title: 'Beat-Making Lab', category: 'workshops', kind: 'workshop', zone: 'event-horizon', day: 0, start: '14:00', end: '16:00', format: 'Build a track from scratch on laptops and pads.' }),
  e({ slug: 'one-minute-film', title: 'One-Minute Film Lab', category: 'workshops', kind: 'workshop', zone: 'event-horizon', day: 1, start: '15:00', end: '17:30', format: 'Shoot and cut a one-minute film on a phone.' }),
  // informals: Free Fall
  e({ slug: 'cosmic-treasure-hunt', title: 'Cosmic Treasure Hunt', category: 'informals', kind: 'competition', zone: 'docking-bay', day: 0, start: '12:30', end: '15:30', format: 'Clues hidden across every sector of the hall.' }),
  e({ slug: 'gaming-arena', title: 'Gaming Arena', category: 'informals', kind: 'competition', zone: 'zero-g', day: 1, start: '11:00', end: '18:00', format: 'Bracketed tournaments, walk-ins welcome.' }),
  e({ slug: 'zero-g-pool-cup', title: 'Zero-G Pool Cup', category: 'informals', kind: 'competition', zone: 'zero-g', day: 0, start: '14:00', end: '19:00', format: 'Knockout pool on the lounge table.' }),
  // experiences: Signals
  e({ slug: 'wormhole-walk', title: 'The Wormhole Walk', category: 'experiences', kind: 'experience', zone: 'wormhole', day: 0, start: '11:00', end: '23:00', format: 'Walk the arch tunnel into the festival.' }),
  e({ slug: 'nebula-portraits', title: 'Nebula Portraits', category: 'experiences', kind: 'experience', zone: 'nebula-walk', day: 1, start: '11:00', end: '22:00', format: 'Portraits against the two-thousand-bulb light curtain.' }),
]

export const eventBySlug = (slug: string) => EVENTS.find((x) => x.slug === slug) ?? null
export const eventsInZone = (zone: string) => EVENTS.filter((x) => x.zone === zone)
export const eventsInCategory = (cat: string) => EVENTS.filter((x) => x.category === cat)
export const HAS_PROVISIONAL = EVENTS.some((x) => x.provisional)

export const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
