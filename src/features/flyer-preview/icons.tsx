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
      {/* A teardrop: a circle whose two straight sides run down to a sharp
          apex, tangent to the circle so the joins are smooth. The reference
          pin measures 23 wide by 39 tall including its stroke; solving for
          a circle at (12, 8) r 5.6 with the apex at y 21.5 gives tangent
          points at (6.9, 10.32) and (17.1, 10.32) and lands on that. An
          all-curves version read visibly bulbous and too short. */}
      <path
        d="M12 21.5 6.9 10.32A5.6 5.6 0 1 1 17.1 10.32Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="8" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export function InfoIcon({ className }: FlyerIconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {/* Speech-bubble ring (a true circle, not the previous version's
         freehand bezier blob, which rendered as an open/lopsided arc
         instead of a closed circle) with a small filled tail bottom-left,
         matching the reference's outline. What was actually wrong,
         and is fixed here, is the mark *inside* it: the reference draws
         an italic serif lowercase "i" (a dot above a forward-leaning
         stem with a small foot serif), not a dot over a plain vertical
         line — the previous straight line, combined with the bubble,
         read as a spiral/arrow at the disc's small rendered size. */}
      <circle cx="12" cy="10.5" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.6 15.9 7.9 17.5 4 20.6Z" fill="currentColor" />
      <ellipse cx="13.5" cy="7.3" rx="1.3" ry="1.5" fill="currentColor" transform="rotate(-15 13.5 7.3)" />
      <line x1="12.9" y1="9.9" x2="10.9" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="9.6" y1="16.1" x2="13" y2="16.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}
