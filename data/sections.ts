/**
 * The site's sections, hung in the far sky as constellations. They start as a few brighter
 * stars among thousands. Hovering one draws it and names the destination; clicking travels
 * there. Found constellations stay drawn (progress you can see).
 */
export type SectionConstellation = {
  id: string
  href: string
  label: string
  plain: string
  az: number
  el: number
  scale: number
  stars: [number, number][]
  edges: [number, number][]
}

export const SECTIONS: SectionConstellation[] = [
  {
    id: 'festival',
    href: '/about',
    label: 'The Festival',
    plain: 'About',
    az: -28,
    el: 30,
    scale: 1900,
    // the insignia: M above the plane, its mirror W below
    stars: [[-1, 0.15], [-1, 1], [0, 0.4], [1, 1], [1, 0.15], [-1, -0.15], [-1, -1], [0, -0.4], [1, -1], [1, -0.15]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 9]],
  },
  {
    id: 'events',
    href: '/events',
    label: 'Enter the Orbit',
    plain: 'Events',
    az: -64,
    el: 18,
    scale: 1500,
    // a spark
    stars: [[0, 0], [0, 1], [0.8, 0.35], [0.75, -0.6], [-0.7, -0.65], [-0.85, 0.3]],
    edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
  },
  {
    id: 'schedule',
    href: '/schedule',
    label: 'Mission Timeline',
    plain: 'Schedule',
    az: 8,
    el: 38,
    scale: 1400,
    // a clock: rim + two hands
    stars: [[0, 1], [0.87, 0.5], [0.87, -0.5], [0, -1], [-0.87, -0.5], [-0.87, 0.5], [0, 0], [0.45, 0.55]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [6, 0], [6, 7]],
  },
  {
    id: 'venue',
    href: '/venue',
    label: 'Land at Yashobhoomi',
    plain: 'Venue map',
    az: -44,
    el: 6,
    scale: 1700,
    // the hall's own footprint: a long rectangle with its central room
    stars: [[-1.4, 0.5], [1.4, 0.5], [1.4, -0.5], [-1.4, -0.5], [-0.3, 0.3], [0.45, 0.3], [0.45, -0.1], [-0.3, -0.1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4]],
  },
  {
    id: 'competitions',
    href: '/competitions',
    label: 'Constellations',
    plain: 'Competitions',
    az: 30,
    el: 14,
    scale: 1400,
    // a trophy
    stars: [[-0.8, 1], [0.8, 1], [0.5, 0.2], [0, -0.1], [-0.5, 0.2], [0, -0.7], [-0.45, -1], [0.45, -1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [3, 5], [5, 6], [5, 7], [6, 7]],
  },
  {
    id: 'artists',
    href: '/artists',
    label: 'Transmissions',
    plain: 'Artists',
    az: -86,
    el: 34,
    scale: 1300,
    // a microphone
    stars: [[0, 1], [0.4, 0.6], [0, 0.2], [-0.4, 0.6], [0, -0.3], [0, -1], [-0.5, -1], [0.5, -1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6], [5, 7]],
  },
]

