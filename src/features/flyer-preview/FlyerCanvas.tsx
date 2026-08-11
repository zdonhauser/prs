// The DOM render of an event flyer. Mirrors PreviewCanvas.tsx's shape and
// idiom (see conventions brief §5): a pure presentational component fed a
// template + the coordinator's field values, with `--f-*` custom
// properties set as inline style from the template's own `colors` object
// (the flyer's theming source is per-template data, not a fixed `data-theme`
// id — see conventions brief §4).
import { useId, useState } from 'react'
import type React from 'react'
import { coverRect, clampPan } from '@/domain/photoGeometry'
import { isFieldEditable, layoutDetailRows } from '@/domain/flyerTemplate'
import { logoSrc } from '@/config/themes'
import prsMarkRaw from '@/assets/prs-mark.svg?raw'
import { CalendarIcon, ClockIcon, MapPinIcon, InfoIcon } from './icons'
import type { FlyerField, FlyerTemplate } from '@/types'

interface FlyerCanvasProps {
  template: FlyerTemplate
  values: Record<FlyerField, string>
}

// The photo clip-circle's bounding box (page px) — center (608, 195),
// radius 227, fitted visually against the hi-res reference (the visual
// spec flagged this pair as "best found visually, not analytically").
// Kept in sync by hand with the matching literals in flyer.css's
// `.flyer-photo` rule, the same "measured box as both CSS and a constant"
// pattern page.css's PHOTO_ZONE already uses (conventions brief §3) —
// needed here because coverRect/clampPan take the box dimensions as plain
// numbers, not a CSS reference.
const PHOTO_BOX = { left: 381, top: -32, size: 454 }

// Watermark base placement/size at watermark.scale === 1, x === y === 0 —
// the reference's measured "~470px across, centered near (120, 250)".
const WATERMARK_BASE_SIZE = 470
const WATERMARK_BASE_CENTER = { x: 120, y: 250 }

// The hero's bottom edge: a circular arc of a large circle whose center
// sits above the page (visual spec's "hero shape" section). Fixed layout
// geometry, not template data — every flyer uses the same hero silhouette.
// Reused both as the hero fill's SVG path `d` and, verbatim, as an SVG
// <clipPath> the watermark is clipped against, so the watermark is clipped
// to the identical silhouette without a second source of truth for the
// numbers. (Previously a CSS `clip-path` on a same-sized wrapper div — see
// the watermark's own render-time comment below for why that didn't
// survive the PDF export's html2canvas raster pass.)
const HERO_PATH = 'M0,0 H816 V234 A780,780 0 0 1 0,355 Z'

interface DetailRowMeta {
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

// Label/icon per field, keyed for lookup once `layoutDetailRows` (domain)
// has decided which fields are visible and where each one sits — this is
// display metadata only, not layout, which is why it isn't in the domain
// module alongside `layoutDetailRows`.
const DETAIL_META: Record<Exclude<FlyerField, 'rscEmail'>, DetailRowMeta> = {
  date: { label: 'DATE:', Icon: CalendarIcon },
  time: { label: 'TIME:', Icon: ClockIcon },
  location: { label: 'LOCATION:', Icon: MapPinIcon },
  additionalInfo: { label: 'ADDITIONAL INFORMATION:', Icon: InfoIcon },
}

export function FlyerCanvas({ template, values }: FlyerCanvasProps) {
  const { colors, watermark, photo, headline } = template
  const hasPhoto = photo.src !== ''

  // Natural photo dimensions aren't part of the template schema (unlike
  // `Photo.naturalW/H` in the story app — see report's "concerns" section),
  // so they're measured off the actual <img> once it loads. Keyed by src
  // so swapping templates can't apply a stale size to a new image; this is
  // rendering-measurement state, not business/form state, the same
  // category PreviewCanvas already accepts via useAutoFitText's internal
  // useState.
  const [photoSize, setPhotoSize] = useState<{ src: string; w: number; h: number } | null>(null)
  const naturalW = photoSize?.src === photo.src ? photoSize.w : undefined
  const naturalH = photoSize?.src === photo.src ? photoSize.h : undefined

  const cssVars = {
    '--f-hero-bg': colors.heroBg,
    '--f-hero-pattern': colors.heroPattern,
    '--f-accent': colors.accent,
    '--f-ring': colors.ring,
    '--f-subtitle': colors.subtitle,
    '--f-icon-circle': colors.iconCircle,
    '--f-body-text': colors.bodyText,
    '--f-footer-bg': colors.footerBg,
  } as React.CSSProperties

  const wmSize = WATERMARK_BASE_SIZE * watermark.scale
  const wmLeft = WATERMARK_BASE_CENTER.x + watermark.x - wmSize / 2
  const wmTop = WATERMARK_BASE_CENTER.y + watermark.y - wmSize / 2

  // html2canvas doesn't support the CSS `clip-path` property (see below),
  // so the id needs to be unique per instance for the SVG <clipPath> to
  // still resolve correctly if two flyers are ever mounted on one page.
  // useId()'s colons are valid in an `id` attribute and this value is only
  // ever consumed via `url(#...)`, never a CSS selector, so there's no need
  // to strip them.
  const watermarkClipId = `flyer-watermark-clip-${useId()}`

  const detailRows = layoutDetailRows(template.editableFields)

  const photoRect = coverRect(naturalW, naturalH, PHOTO_BOX.size, PHOTO_BOX.size)
  const { x: panX, y: panY } = clampPan(naturalW, naturalH, PHOTO_BOX.size, PHOTO_BOX.size, 0, 0, 1)

  return (
    <div className="flyer" style={cssVars}>
      {/* Hero shape + watermark. The watermark lives inside this same
          inline <svg> now, clipped by an SVG <clipPath> built from the same
          HERO_PATH the hero fill uses — not a CSS clip-path on a wrapper
          div, because html2canvas's raster pass doesn't support that CSS
          property and used to let the mark bleed past the hero's curved
          edge in the exported PDF (the preview, a real browser, always
          clipped it correctly). An <svg>'s *native* clipPath is honoured by
          html2canvas because it hands the whole <svg> subtree to the
          browser to rasterize as a self-contained image, rather than
          painting it node-by-node itself. */}
      <svg className="flyer-hero" viewBox="0 0 816 1056" preserveAspectRatio="none" aria-hidden="true">
        <path className="flyer-hero-shape" d={HERO_PATH} />
        <defs>
          <clipPath id={watermarkClipId}>
            <path d={HERO_PATH} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${watermarkClipId})`}>
          {/* `color` is set to the template's already-resolved hex
              (colors.heroPattern) rather than `var(--f-hero-pattern)`,
              which is defined on the outer `.flyer` element, outside this
              <svg> subtree. Tested both directly (exported a PDF with each,
              rendered it back to an image, diffed): with the installed
              html2canvas version they come out byte-identical, so the var
              does get resolved correctly here too. Keeping the literal hex
              anyway rather than reverting this note to "either works" —
              it doesn't depend on html2canvas's own undocumented behavior
              for a custom property inherited from outside the serialized
              <svg> fragment, which a future html2canvas version is free to
              change without notice. */}
          <svg
            x={wmLeft}
            y={wmTop}
            width={wmSize}
            height={wmSize}
            opacity={watermark.opacity}
            style={{ color: colors.heroPattern }}
            dangerouslySetInnerHTML={{ __html: prsMarkRaw }}
          />
        </g>
      </svg>

      {/* Eyebrow + headline */}
      <div className="flyer-eyebrow">{template.eyebrow}</div>
      <div className="flyer-headline">
        {headline.map((line, i) => (
          <div key={i} className="flyer-headline-line">
            {line}
          </div>
        ))}
      </div>

      {/* Teal ring (drawn first so the opaque photo box paints over the
          part of the ring it covers) + photo circle */}
      <div className="flyer-ring" />
      <div className="flyer-photo" style={{ left: PHOTO_BOX.left, top: PHOTO_BOX.top, width: PHOTO_BOX.size, height: PHOTO_BOX.size }}>
        {hasPhoto && (
          <img
            src={photo.src}
            alt=""
            onLoad={(e) => {
              const img = e.currentTarget
              setPhotoSize({ src: photo.src, w: img.naturalWidth, h: img.naturalHeight })
            }}
            style={{
              left: photoRect.left,
              top: photoRect.top,
              width: photoRect.width,
              height: photoRect.height,
              transform: `translate(${panX}px, ${panY}px)`,
              transformOrigin: 'center center',
            }}
          />
        )}
      </div>

      {/* Subtitle + ornament + description */}
      <div className="flyer-subtitle">{template.subtitle}</div>
      <div className="flyer-ornament">
        <div className="flyer-ornament-rule" />
        <div className="flyer-ornament-dot" />
        <div className="flyer-ornament-rule" />
      </div>
      <div className="flyer-description">{template.description}</div>

      {/* Detail rows — a field missing from `editableFields` doesn't render
          at all (no icon, no label); `layoutDetailRows` (domain) is what
          decides which of the three fixed slots each visible field lands
          in, so the remaining rows close up rather than leaving a hole. */}
      {detailRows.map(({ field, top, left }) => {
        const { label, Icon } = DETAIL_META[field]
        return (
          <div key={field} className="flyer-detail" style={{ top, left }}>
            <div className="flyer-detail-icon">
              <Icon className="flyer-detail-icon-glyph" />
            </div>
            <div className="flyer-detail-label">
              {label}
              {values[field] && <span className="flyer-detail-value"> {values[field]}</span>}
            </div>
          </div>
        )
      })}

      {/* Footer — `rscEmail` is independent of the three detail slots above:
          when it isn't editable, the footer prints the logo alone with no
          label at all, rather than a permanently-blank "RSC EMAIL:". */}
      <div className="flyer-footer">
        <img src={logoSrc.white} alt="Portfolio Resident Services" className="flyer-footer-logo" />
        {isFieldEditable(template, 'rscEmail') && (
          <div className="flyer-footer-label">
            RSC EMAIL:{values.rscEmail && <span className="flyer-detail-value"> {values.rscEmail}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
