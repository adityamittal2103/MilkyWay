import type { Artist } from '../artists'

/**
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ PROVISIONAL: TEST TRANSMISSIONS, NOT ANNOUNCED ARTISTS                    │
 * │                                                                          │
 * │ These prove the decryption-transmission system before the line-up is     │
 * │ public. The faces are sculpted placeholder identities (rendered from     │
 * │ geometry, not photographs of anyone) and the audio is a synthetic test   │
 * │ signal. Every entry is `provisional: true` and the UI says so. They      │
 * │ disappear automatically once data/artists.ts ARTISTS has entries.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
const note = 'A test transmission. The line-up is still decrypting: when this slot is confirmed, the artist’s own portrait and signal replace this placeholder.'

export const PROVISIONAL_TRANSMISSIONS: Artist[] = [
  {
    id: 'tx-001',
    name: 'Headliner',
    image: '/artists/tx-001.png',
    imageKind: 'baked',
    audio: null,
    genre: 'music',
    day: 1,
    time: '20:00',
    venue: 'supergiant',
    colour: ['#3F7BFF', '#3FE0FF'],
    transmissionSeed: 1107,
    description: note,
    event: 'headline-night',
    provisional: true,
  },
  {
    id: 'tx-002',
    name: 'Guest Selector',
    image: '/artists/tx-002.png',
    imageKind: 'baked',
    audio: null,
    genre: 'music',
    day: 1,
    time: '17:00',
    venue: 'supergiant',
    colour: ['#8A5CFF', '#FF3EC8'],
    transmissionSeed: 2291,
    description: note,
    event: 'dj-face-off',
    provisional: true,
  },
  {
    id: 'tx-003',
    name: 'Comedy Special',
    image: '/artists/tx-003.png',
    imageKind: 'baked',
    audio: null,
    genre: 'comedy',
    day: 0,
    time: '20:00',
    venue: 'constellation-hall',
    colour: ['#FFB547', '#5A4BFF'],
    transmissionSeed: 3373,
    description: note,
    event: 'stand-up-night',
    provisional: true,
  },
  {
    id: 'tx-004',
    name: 'Guest Showcase',
    image: '/artists/tx-004.png',
    imageKind: 'baked',
    audio: null,
    genre: 'dance',
    day: 1,
    time: '13:00',
    venue: 'supergiant',
    colour: ['#FF3EC8', '#8A5CFF'],
    transmissionSeed: 4481,
    description: note,
    event: 'group-dance',
    provisional: true,
  },
]
