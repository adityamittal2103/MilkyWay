/**
 * Event categories. Each one is drawn in the sky as its own hand-authored constellation.
 * `stars` are normalised 2D points (−1…1), `edges` connect star indices.
 * `sky` places the constellation on the dome above the hall (azimuth°, elevation°).
 */
export type Category = {
  id: string
  name: string
  cosmic: string
  line: string
  accent: string
  stars: [number, number][]
  edges: [number, number][]
  sky: { az: number; el: number; scale: number }
}

export const CATEGORIES: Category[] = [
  {
    id: 'music',
    name: 'Music',
    cosmic: 'Sonic Core',
    line: 'Stages, sets and the loudest object in the sky.',
    accent: '#3F7BFF',
    // a waveform
    stars: [[-1, 0], [-0.6, 0.55], [-0.25, -0.5], [0.1, 0.8], [0.45, -0.3], [0.8, 0.35], [1, 0]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
    sky: { az: -56, el: 30, scale: 58 },
  },
  {
    id: 'dance',
    name: 'Dance',
    cosmic: 'Kinetic Cluster',
    line: 'Bodies in orbit. Crews, solos, battles.',
    accent: '#FF3EC8',
    // a figure mid-spin
    stars: [[0, 0.95], [0, 0.45], [-0.7, 0.75], [0.65, 0.2], [0, -0.15], [-0.5, -0.9], [0.55, -0.75]],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4], [4, 5], [4, 6]],
    sky: { az: -30, el: 54, scale: 50 },
  },
  {
    id: 'theatre',
    name: 'Theatre',
    cosmic: 'Proscenium',
    line: 'Street plays and stage plays, with an audience in every direction.',
    accent: '#FFB547',
    // an arch
    stars: [[-1, -0.8], [-0.95, 0.1], [-0.55, 0.75], [0, 0.95], [0.55, 0.75], [0.95, 0.1], [1, -0.8]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
    sky: { az: -6, el: 26, scale: 58 },
  },
  {
    id: 'fashion',
    name: 'Fashion',
    cosmic: 'Orbital Runway',
    line: 'A runway that bends with the galaxy.',
    accent: '#FF4F9A',
    // a runway with a turn
    stars: [[-1, -0.6], [-0.4, -0.45], [0.2, -0.3], [0.75, -0.1], [0.95, 0.35], [0.55, 0.7]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    sky: { az: 20, el: 50, scale: 52 },
  },
  {
    id: 'comedy',
    name: 'Comedy',
    cosmic: 'Laughter Field',
    line: 'Open mics and stand-up. Low gravity, high pressure.',
    accent: '#FF8A3D',
    // a grin
    stars: [[-0.9, 0.4], [-0.6, -0.2], [0, -0.5], [0.6, -0.2], [0.9, 0.4], [-0.35, 0.7], [0.35, 0.7]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
    sky: { az: 46, el: 28, scale: 52 },
  },
  {
    id: 'art',
    name: 'Art',
    cosmic: 'Nebula',
    line: 'Murals, exhibitions and things you are allowed to touch.',
    accent: '#A14DFF',
    // a loose cloud
    stars: [[-0.8, 0], [-0.35, 0.55], [0.2, 0.4], [0.75, 0.6], [0.55, -0.15], [0, -0.6], [-0.5, -0.45]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [2, 5]],
    sky: { az: 64, el: 56, scale: 48 },
  },
  {
    id: 'workshops',
    name: 'Workshops',
    cosmic: 'The Lab',
    line: 'Short, hands-on sessions. Leave with something you made.',
    accent: '#3FE0FF',
    // a beaker
    stars: [[-0.35, 0.95], [-0.35, 0.2], [-0.9, -0.8], [0.9, -0.8], [0.35, 0.2], [0.35, 0.95]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
    sky: { az: -68, el: 58, scale: 46 },
  },
  {
    id: 'informals',
    name: 'Informals',
    cosmic: 'Free Fall',
    line: 'Games, hunts and the pool table everybody ends up at.',
    accent: '#C6FF3D',
    // dice-like square with a diagonal
    stars: [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0, 0]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 2]],
    sky: { az: -38, el: 12, scale: 42 },
  },
  {
    id: 'experiences',
    name: 'Experiences',
    cosmic: 'Signals',
    line: 'Installations built into the hall itself.',
    accent: '#7A5CFF',
    // a transmission: dot with radiating ticks
    stars: [[0, 0], [0, 0.9], [0.78, 0.45], [0.78, -0.45], [0, -0.9], [-0.78, -0.45], [-0.78, 0.45]],
    edges: [[0, 1], [0, 3], [0, 5]],
    sky: { az: 30, el: 10, scale: 44 },
  },
]

export const categoryById = (id: string | null | undefined) => CATEGORIES.find((c) => c.id === id) ?? null
