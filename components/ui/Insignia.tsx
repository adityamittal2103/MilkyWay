/**
 * The MILKY WAY insignia: the galactic plane as a rule, M above it, its reflection (W) below.
 * MILKY WAY is one letter and its mirror.
 */
export function Insignia({ size = 30, title = 'Milky Way' }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label={title}>
      <line x1="1" y1="16" x2="31" y2="16" stroke="currentColor" strokeWidth="1.2" />
      <polyline points="5,13.5 5,3.5 16,10.5 27,3.5 27,13.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" />
      <polyline points="5,18.5 5,28.5 16,21.5 27,28.5 27,18.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="miter" opacity="0.45" />
      <circle cx="16" cy="16" r="1.8" fill="var(--flare)" />
    </svg>
  )
}
