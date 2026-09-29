/**
 * Destinations. `label` is the brand line, `plain` the conventional name (used for a11y + SEO).
 * `star` places each destination in the constellation navigation (normalised −1…1).
 */
export type NavItem = { href: string; label: string; plain: string; code: string; star: [number, number] }

export const NAV: NavItem[] = [
  { href: '/', label: 'The Journey', plain: 'Home', code: '00', star: [-0.82, 0.12] },
  { href: '/events', label: 'Enter the Orbit', plain: 'Events', code: '01', star: [-0.42, 0.58] },
  { href: '/venue', label: 'Land at Yashobhoomi', plain: 'Venue map', code: '02', star: [-0.05, 0.05] },
  { href: '/schedule', label: 'Mission Timeline', plain: 'Schedule', code: '03', star: [0.36, 0.62] },
  { href: '/competitions', label: 'Constellations', plain: 'Competitions', code: '04', star: [0.52, -0.1] },
  { href: '/artists', label: 'Transmissions', plain: 'Artists', code: '05', star: [0.12, -0.62] },
  { href: '/register', label: 'Board the Milky Way', plain: 'Register', code: '06', star: [0.86, 0.3] },
]

export const NAV_SECONDARY: { href: string; label: string }[] = [
  { href: '/about', label: 'About' },
  { href: '/partners', label: 'Partners' },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' },
]
