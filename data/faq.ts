import { FESTIVAL } from './festival'

/** Answers only state what is known. Unknowns point to where the answer will appear. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: 'What is Milky Way?',
    a: `${FESTIVAL.organiser}'s ${FESTIVAL.descriptor.toLowerCase()}, themed ${FESTIVAL.theme}.`,
  },
  {
    q: 'Where is it?',
    a: `${FESTIVAL.venue.name}, the ${FESTIVAL.venue.formal} in ${FESTIVAL.venue.locality}, ${FESTIVAL.venue.city}.`,
  },
  {
    q: 'When is it?',
    a: 'Dates will be announced on this site first. Board now to get the transmission when they drop.',
  },
  {
    q: 'How do I register?',
    a: 'Open “Board the Milky Way”. The form takes under a minute. Event-specific registrations open with each event.',
  },
  {
    q: 'Is the venue map real?',
    a: 'Yes. The 3D map is built directly from the festival floor plan. Which activity sits in which sector is provisional until the final programme is published.',
  },
  {
    q: 'Are the events on this site confirmed?',
    a: 'Not yet. Anything marked “provisional” is a placeholder format that shows how the programme will be laid out. The real line-up replaces it when announced.',
  },
  {
    q: 'My device struggles with 3D. Can I still use the site?',
    a: 'Yes. Every page works without 3D. The site lowers its visual quality automatically on smaller devices and respects reduced-motion settings.',
  },
]
