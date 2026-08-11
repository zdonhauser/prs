// Inline SVG glyphs for the flyer's four detail rows (date, time, location,
// additional info). Each is a simple outline drawn in `currentColor` so
// `flyer.css` controls the color (the accent color, on a filled disc) —
// mirrors the reference's solid-weight line icons. No local state, no
// business logic; pure presentational leaves, same spirit as the rest of
// `features/flyer-preview`.

interface FlyerIconProps {
  className?: string
}

export function CalendarIcon({ className }: FlyerIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="3.5" y1="10" x2="20.5" y2="10" stroke="currentColor" strokeWidth="1.6" />
      <line x1="7.5" y1="3.2" x2="7.5" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="3.2" x2="12" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="16.5" y1="3.2" x2="16.5" y2="7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {[0, 1].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={6.4 + col * 3.1}
            y={12.4 + row * 3.1}
            width="1.9"
            height="1.9"
            fill="currentColor"
          />
        ))
      )}
    </svg>
  )
}

export function ClockIcon({ className }: FlyerIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="12" y1="12" x2="12" y2="6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="12" y1="12" x2="16" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function MapPinIcon({ className }: FlyerIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21.5c4-4.6 7-8.7 7-12.3A7 7 0 0 0 5 9.2c0 3.6 3 7.7 7 12.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function InfoIcon({ className }: FlyerIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Speech-bubble outline (a small pointed tail bottom-left), matching
         the reference's "additional information" glyph rather than a
         plain circle. */}
      <path
        d="M12 2.5a9 9 0 1 0-5.6 16.1L5.8 22l4.1-2.6c.7.1 1.4.1 2.1 0A9 9 0 0 0 12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7.6" r="1" fill="currentColor" />
      <line x1="12" y1="10.4" x2="12" y2="14.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
