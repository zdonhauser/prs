import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { rectToPageInches, parseRgb, deliverPdf } from './shared'
import { coverRect, clampPan } from '@/domain/photoGeometry'
import { PAGE_W } from '@/config/page'
import type { FlyerTemplate } from '@/types'

// ─────────────────────────────────────────────────────────────────────────
// Layered flyer PDF export — same philosophy as exportPdf.ts's story
// export (see that file's header comment), adapted to the flyer's shapes:
//   1. Background raster — hero, watermark, ornament, detail-row icons,
//      footer band/logo, AND THE HEADLINE (see below) — everything that's
//      either genuinely just pixels, or can't be reproduced as vector text.
//   2. The circular photo — pre-rendered to an offscreen canvas with a
//      circular clip (real alpha outside the disc) so it can be placed as
//      its own PNG object, the flyer's equivalent of the story's per-cell
//      photo layer.
//   3. The teal ring — redrawn as a vector circle stroke *after* the photo,
//      matching flyer.css's z-index (the ring straddles the photo's own
//      edge; baking it into the background would let the photo layer,
//      added afterward, paint over the part of the ring that crosses the
//      photo).
//   4. Vector text — eyebrow, subtitle, description, the four detail-row
//      labels and the coordinator's entered values, and the footer label +
//      its entered value. Measured the same way exportPdf.ts measures text
//      (computed style off the live DOM, not re-implemented in jsPDF units).
//
// The headline is the one exception to "text is vector": the reference
// face is a heavy wide grotesque with no equivalent in jsPDF's built-in
// fonts (no black weight, no horizontal scaling), so flyer.css substitutes
// Arial Black + a CSS scaleX() squeeze — a browser-rendering trick with no
// jsPDF equivalent. It stays 100% raster, never drawn as vector text; the
// split between what's raster and what's vector is exactly as specified.
//
// It is NOT baked into the single background raster, though, despite the
// straightforward reading of "rasterize it into the background layer" —
// the reference's headline is designed to sit visually on top of the
// photo (the CSS z-index puts it above `.flyer-photo`, and the last few
// letters of a long line legitimately overlap the photo circle). Baking
// the headline into the one background raster and then adding the photo
// on top afterward — the naive version of "the background layer" — makes
// the opaque photo cover whatever headline pixels fall inside its circle,
// which is the opposite of the live page's stacking and, measured against
// a real export, cuts "SAFER"/"COMMUNITIES" off mid-word. So the headline
// gets its own small raster capture (still just pixels, still no font
// embedded, still never vector text) taken with a transparent background
// and composited in after the photo layer — see Layer 2.5 below. This
// preserves the decided split (headline raster, everything else vector,
// no font embedding) and only changes *when* the headline's pixels get
// stamped onto the page, which the "matching the on-screen preview"
// requirement in the same brief section requires.
// ─────────────────────────────────────────────────────────────────────────

// Raster scale for the two small alpha-PNG layers (the photo circle and the
// headline patch) — deliberately lower than the background raster's own
// `scale: 4`. At 4x, a CSS px maps to 4 output px, i.e. 4 * 96 = 384 DPI —
// well past the ~300 DPI print ceiling (finer detail than that is invisible
// on paper) and expensive in bytes, since both layers are stored as
// uncompressed-ish raw pixels (PNG for real alpha; jsPDF's addImage without
// a `compression` argument stores raw RGB, and even with Flate compression
// applied, photographic pixels don't compress well). 3x -> 288 DPI, still
// comfortably sharp at 100% zoom, at 9/16 the pixel count of 4x. Does not
// apply to the background layer (JPEG, `scale: 4`, unchanged — it's already
// the same quality/size trade at a good size and the brief asks not to
// touch it).
const DETAIL_RASTER_SCALE = 3

// Renders the live `<img>` cover-fit into a `size`×`size` offscreen canvas,
// clipped to the inscribed circle so the corners stay transparent (kept as
// real alpha by exporting PNG, not JPEG) — the flyer's photo has no crop
// UI, so pan/zoom are always 0/0/1, unlike the story's preRenderPhoto.
function preRenderCircularPhoto(img: HTMLImageElement, naturalW: number, naturalH: number, size: number): HTMLCanvasElement {
  const offscreen = document.createElement('canvas')
  offscreen.width = size * DETAIL_RASTER_SCALE
  offscreen.height = size * DETAIL_RASTER_SCALE
  const ctx = offscreen.getContext('2d')!
  ctx.scale(DETAIL_RASTER_SCALE, DETAIL_RASTER_SCALE)

  const rect = coverRect(naturalW, naturalH, size, size)
  const { x: panX, y: panY } = clampPan(naturalW, naturalH, size, size, 0, 0, 1)

  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()

  ctx.translate(size / 2, size / 2)
  ctx.translate(panX, panY)
  ctx.translate(-size / 2, -size / 2)
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)
  ctx.restore()

  return offscreen
}

// Draws one run of text at a DOM rect/computed-style pair, in page-space —
// the same measurement approach exportPdf.ts uses for the story's text
// layer (computed font/color/letter-spacing/line-height off the live DOM),
// generalized to take an explicit rect/style/text instead of always the
// same element's own, since a flyer detail row draws two runs (a label and
// its value) from two different elements sharing one line.
function drawFlyerText(pdf: jsPDF, text: string, rect: DOMRect, style: CSSStyleDeclaration, pageRect: DOMRect, domScale: number, multiline = false): void {
  const { xIn, yIn, wIn } = rectToPageInches(rect, pageRect, domScale)

  const fontSizePx = parseFloat(style.fontSize)
  const fontWeight = parseInt(style.fontWeight, 10) || 400
  const { r, g, b } = parseRgb(style.color)
  const letterSpacingPx = parseFloat(style.letterSpacing) || 0 // "normal" -> NaN -> 0

  const lineHeightRaw = parseFloat(style.lineHeight)
  const lineHeightPx = Number.isNaN(lineHeightRaw) ? fontSizePx * 1.2 : lineHeightRaw
  const halfLeadingIn = (lineHeightPx - fontSizePx) / 2 / 96

  pdf.setFont('helvetica', fontWeight >= 600 ? 'bold' : 'normal')
  pdf.setFontSize(fontSizePx * 0.75) // CSS px -> PDF pt
  pdf.setTextColor(r, g, b)

  const isCenter = style.textAlign === 'center'
  const xText = isCenter ? xIn + wIn / 2 : xIn
  const yText = yIn + halfLeadingIn

  if (multiline) {
    const widthIn = (wIn * 96 - 2) / 96 // 2px safety margin against clipping the last char of a line
    const lines: string[] = pdf.splitTextToSize(text, widthIn)
    // Unlike the story export's one multiline element (.page-narrative-text,
    // always left-aligned), .flyer-description is text-align: center — jsPDF
    // needs an explicit align:'center' per line or it treats xText as the
    // left edge instead of the centerline, pushing every line off-center.
    pdf.text(lines, xText, yText, {
      baseline: 'top',
      lineHeightFactor: lineHeightPx / fontSizePx,
      ...(isCenter ? { align: 'center' as const } : {}),
      ...(letterSpacingPx !== 0 ? { charSpace: letterSpacingPx / 96 } : {}),
    })
  } else {
    pdf.text(text, xText, yText, {
      baseline: 'top',
      ...(isCenter ? { align: 'center' as const } : {}),
      ...(letterSpacingPx !== 0 ? { charSpace: letterSpacingPx / 96 } : {}),
    })
  }
}

// A `.flyer-detail-label`/`.flyer-footer-label` element's own text (e.g.
// "DATE:") is a direct text-node child sitting alongside an optional
// `.flyer-detail-value` span — `el.textContent` would run the two
// together, so only the direct text-node children are taken.
function labelOwnText(el: HTMLElement): string {
  return Array.from(el.childNodes)
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent ?? '')
    .join('')
}

// A detail row's label and its coordinator-entered value render as two
// different inline styles inside one element (the label is bold/uppercase,
// the value is a lighter weight with case preserved) — drawn as two
// separate vector-text runs, each measured off its own element, rather
// than one run in a single style.
function drawLabelAndValue(pdf: jsPDF, labelEl: HTMLElement, pageRect: DOMRect, domScale: number): void {
  drawFlyerText(pdf, labelOwnText(labelEl), labelEl.getBoundingClientRect(), getComputedStyle(labelEl), pageRect, domScale)

  const valueEl = labelEl.querySelector<HTMLElement>('.flyer-detail-value')
  if (valueEl) {
    drawFlyerText(pdf, valueEl.textContent ?? '', valueEl.getBoundingClientRect(), getComputedStyle(valueEl), pageRect, domScale)
  }
}

export async function exportFlyerPdf(flyerElement: HTMLElement | null, { template }: { template: FlyerTemplate }): Promise<void> {
  if (!flyerElement) throw new Error('No flyer element')

  // Measured once and reused for every layer below — see rectToPageInches.
  const pageRect = flyerElement.getBoundingClientRect()
  const domScale = pageRect.width / PAGE_W

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  })

  // ── Layer 1: background raster (headline excluded — see header comment) ──
  const backgroundCanvas = await html2canvas(flyerElement, {
    scale: 4,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    onclone: (clonedDoc) => {
      clonedDoc
        .querySelectorAll<HTMLElement>('.flyer-photo, .flyer-ring, .flyer-headline, .flyer-eyebrow, .flyer-subtitle, .flyer-description, .flyer-detail-label, .flyer-footer-label')
        .forEach(el => {
          el.style.visibility = 'hidden'
        })
    },
  })
  pdf.addImage(backgroundCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 8.5, 11)

  // ── Layer 2: the circular photo, as its own PNG object (real alpha) ──
  const photoBox = flyerElement.querySelector<HTMLElement>('.flyer-photo')
  const img = photoBox?.querySelector('img') ?? null
  if (photoBox && img) {
    const { xIn, yIn, wIn } = rectToPageInches(photoBox.getBoundingClientRect(), pageRect, domScale)
    const sizePx = wIn * 96 // .flyer-photo is always a square box
    const canvas = preRenderCircularPhoto(img, img.naturalWidth, img.naturalHeight, sizePx)
    // 'MEDIUM' Flate-compresses the raw pixel data jsPDF would otherwise
    // store verbatim — see DETAIL_RASTER_SCALE's comment for why this alone
    // isn't enough for a photographic image and the scale is lowered too.
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xIn, yIn, wIn, wIn, undefined, 'MEDIUM')
  }

  // ── Layer 2.5: the headline, its own raster patch drawn after the photo ──
  // A transparent-background capture of just this element — still pixels,
  // still no vector text, still no embedded font — composited on top of
  // the photo instead of baked into the layer-1 background. See the
  // header comment for why: the live page's CSS z-index puts the headline
  // above the photo, and letters legitimately overlap the photo circle.
  const headline = flyerElement.querySelector<HTMLElement>('.flyer-headline')
  if (headline) {
    const headlineCanvas = await html2canvas(headline, {
      scale: DETAIL_RASTER_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    })
    const { xIn, yIn, wIn, hIn } = rectToPageInches(headline.getBoundingClientRect(), pageRect, domScale)
    pdf.addImage(headlineCanvas.toDataURL('image/png'), 'PNG', xIn, yIn, wIn, hIn, undefined, 'MEDIUM')
  }

  // ── Layer 3: the teal ring, vector circle stroke drawn after the photo ──
  // (and after the headline patch — the live page's DOM order puts the
  // ring after the headline at the same z-index, so the ring paints over
  // any headline pixels it crosses too, same as it does over the photo.)
  const ring = flyerElement.querySelector<HTMLElement>('.flyer-ring')
  if (ring) {
    const ringStyle = getComputedStyle(ring)
    const borderWidthPx = parseFloat(ringStyle.borderTopWidth)
    if (borderWidthPx > 0) {
      const { xIn, yIn, wIn, hIn } = rectToPageInches(ring.getBoundingClientRect(), pageRect, domScale)
      const { r, g, b } = parseRgb(ringStyle.borderTopColor)
      const bwIn = borderWidthPx / 96
      // border-box sizing draws the border inside the element's own edge,
      // so the stroke's true centerline sits half a border-width in from
      // the box edge — same inset logic exportPdf.ts uses for the story's
      // photo-frame rect, applied to a circle radius instead.
      const cxIn = xIn + wIn / 2
      const cyIn = yIn + hIn / 2
      const rIn = wIn / 2 - bwIn / 2
      pdf.setDrawColor(r, g, b)
      pdf.setLineWidth(bwIn)
      pdf.circle(cxIn, cyIn, rIn, 'S')
    }
  }

  // ── Layer 4: vector text ──────────────────────────────────────────────
  // Both wrap on screen (neither .flyer-eyebrow nor .flyer-subtitle sets
  // white-space: nowrap), so both need the same splitTextToSize treatment
  // .flyer-description already gets below — without it, a long eyebrow or
  // subtitle draws as one wide centered/left line that runs off the 8.5in
  // page instead of wrapping to match the preview.
  const eyebrow = flyerElement.querySelector<HTMLElement>('.flyer-eyebrow')
  if (eyebrow) drawFlyerText(pdf, eyebrow.textContent ?? '', eyebrow.getBoundingClientRect(), getComputedStyle(eyebrow), pageRect, domScale, true)

  const subtitle = flyerElement.querySelector<HTMLElement>('.flyer-subtitle')
  if (subtitle) drawFlyerText(pdf, subtitle.textContent ?? '', subtitle.getBoundingClientRect(), getComputedStyle(subtitle), pageRect, domScale, true)

  const description = flyerElement.querySelector<HTMLElement>('.flyer-description')
  if (description) drawFlyerText(pdf, description.textContent ?? '', description.getBoundingClientRect(), getComputedStyle(description), pageRect, domScale, true)

  flyerElement.querySelectorAll<HTMLElement>('.flyer-detail-label, .flyer-footer-label').forEach(labelEl => {
    drawLabelAndValue(pdf, labelEl, pageRect, domScale)
  })

  const slug = template.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_')
  const filename = `Event_Flyer_${slug}_${template.month}.pdf`

  await deliverPdf(pdf, filename)
}
