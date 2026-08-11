import { jsPDF } from 'jspdf'
import { coverRect, clampPan } from '@/domain/photoGeometry'
import type { Photo } from '@/types'

// ─────────────────────────────────────────────────────────────────────────
// Shared PDF-export plumbing, used by both the story export (exportPdf.ts)
// and the flyer export (exportFlyerPdf.ts). Extracted verbatim from
// exportPdf.ts — behavior unchanged, see exportPdf.ts's own header comment
// for the layered-PDF strategy this supports.
// ─────────────────────────────────────────────────────────────────────────

// Converts a live DOM rect into page-space inches. The preview may be
// wrapped in a CSS transform: scale(...) for on-screen zoom controls —
// getBoundingClientRect reflects that scaling, so every measurement has to
// be divided by domScale first to get back to the page's native 816×1056
// px space before converting to the inches jsPDF's `unit: 'in'` expects.
export function rectToPageInches(rect: DOMRect, pageRect: DOMRect, domScale: number) {
  return {
    xIn: (rect.left - pageRect.left) / domScale / 96,
    yIn: (rect.top - pageRect.top) / domScale / 96,
    wIn: rect.width / domScale / 96,
    hIn: rect.height / domScale / 96,
  }
}

// getComputedStyle colors come back as "rgb(r, g, b)" or "rgba(r, g, b, a)".
// jsPDF's color setters want separate numeric channels, so pull them out
// by hand rather than pulling in a color-parsing dependency for this alone.
export function parseRgb(color: string): { r: number; g: number; b: number } {
  const match = color.match(/rgba?\(([^)]+)\)/)
  const parts = (match?.[1] ?? '').split(',').map(n => parseFloat(n.trim()))
  return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0 }
}

// Draws one photo exactly as the preview shows it — cover-fit, then the
// clamped pan/zoom — into an offscreen canvas at 4x the cell's native
// size, matching the resolution the old full-page html2canvas capture
// used to produce. Draws straight from the live <img> (never swapped or
// mutated — see the note in exportToPDF), which is already decoded because
// it's the same element the browser has been painting on screen all along.
export function preRenderPhoto(img: HTMLImageElement, photo: Partial<Photo>, cellW: number, cellH: number): HTMLCanvasElement {
  const offscreen = document.createElement('canvas')
  offscreen.width = cellW * 4
  offscreen.height = cellH * 4
  const ctx = offscreen.getContext('2d')!
  // Scale up front so every coordinate below can stay in the same cell-px
  // space the geometry math (coverRect/clampPan) already uses, instead of
  // multiplying each one by 4 by hand.
  ctx.scale(4, 4)

  // Prefer the dimensions captured at upload (what the preview's own
  // geometry used); fall back to the live element for legacy photos.
  const naturalW = photo.naturalW ?? img.naturalWidth
  const naturalH = photo.naturalH ?? img.naturalHeight
  const rect = coverRect(naturalW, naturalH, cellW, cellH)
  const zoom = photo.zoom ?? 1
  const { x: panX, y: panY } = clampPan(naturalW, naturalH, cellW, cellH, photo.panX ?? 0, photo.panY ?? 0, zoom)

  // Replicate CSS: translate(panX,panY) scale(zoom) with transform-origin: center center
  ctx.translate(cellW / 2, cellH / 2)
  ctx.translate(panX, panY)
  ctx.scale(zoom, zoom)
  ctx.translate(-cellW / 2, -cellH / 2)
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)

  return offscreen
}

// Hands the finished PDF to the user: downloads it everywhere except iOS,
// where the Web Share sheet is used instead so the user isn't dropped into
// a new tab with no visible way to save the file.
//
// iOS Safari (incl. installed PWAs) ignores the anchor `download`
// attribute, so jsPDF's default save() just opens the PDF in a new tab —
// user then has to tap Share > Save to Files themselves. The Web Share
// API opens that same share sheet directly, in one tap.
//
// navigator.canShare({ files }) also returns true on desktop Chrome and
// desktop Safari, but the macOS/Windows share sheet it opens there has no
// "save to disk" option at all (AirDrop, Mail, Messages, Notes — no Save)
// — so on a laptop this trapped the user in a menu with no way to
// actually get the file. Every non-iOS platform's plain `download`
// attribute works fine, so only take the Share API path on iOS/iPadOS,
// where it's the one place the plain download is actually broken.
// iPadOS 13+ reports a desktop Mac user agent, so the common fix is to
// also check "MacIntel" + touch support — but that alone false-positived
// on a real MacBook in testing here (some Mac trackpads report nonzero
// maxTouchPoints for multi-touch gesture recognition, even though
// there's no touchscreen). Also requiring a coarse pointer closes that
// gap: a real trackpad/mouse always reports "fine" pointer precision,
// while an actual touchscreen (iPad) reports "coarse" — so this only
// fires for a device that both claims touch support AND is actually
// touch-operated.
export async function deliverPdf(pdf: jsPDF, filename: string): Promise<void> {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1 &&
      window.matchMedia('(pointer: coarse)').matches)

  if (isIOS && navigator.canShare) {
    const file = new File([pdf.output('blob')], filename, { type: 'application/pdf' })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return
      } catch (err) {
        if (err && (err as { name?: string }).name === 'AbortError') return // user cancelled the share sheet
        // fall through to the plain download below
      }
    }
  }

  pdf.save(filename)
}
