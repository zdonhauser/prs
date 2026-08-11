// Browser-infra helpers for the creator's photo picker: read a chosen file
// into a croppable in-memory photo, then bake the crop the author dialed in
// (via the reused PhotoCropModal) into the final `photo.src` data URL the
// template ships with. Not a `services/` module (it isn't generic infra
// reused across the app the way imageConversion/textMeasure are) — kept
// local to this one feature, same as PhotoSection.tsx keeps its own
// `readAsPhoto` helper inline rather than promoting it.
import { normalizeImageFile } from '@/services/imageConversion'
import { coverRect, clampPan } from '@/domain/photoGeometry'
import type { CropResult, Photo, PhotoBox } from '@/types'

/** A freshly-picked photo, before any crop adjustment. `Photo`'s full shape
    (id/src/naturalW/naturalH/zoom/panX/panY) is exactly what's needed to
    hand this straight to the reused `PhotoCropModal` — this alias exists
    only to name the "not yet baked into the template" state distinctly
    from a `Photo` living in the story app's own photo array. */
export type PendingPhoto = Photo

/** The crop-cell size to use for both the crop modal and the bake below,
    preserving `box`'s aspect ratio so a non-square photo box (an ellipse,
    not a circle) gets a matching crop frame instead of a square one — a
    square crop on a wide box would let the flyer show only a slice of
    what the author framed. The longer edge is capped at 1600 (the export
    ceiling) but never upscaled past the source image's own longer edge,
    same as before; the shorter edge follows `box`'s ratio off that. */
export function cropCellSize(
  photo: Pick<PendingPhoto, 'naturalW' | 'naturalH'>,
  box: Pick<PhotoBox, 'width' | 'height'>
): { w: number; h: number } {
  const longEdge = Math.max(photo.naturalW ?? 1600, photo.naturalH ?? 1600)
  const cap = Math.min(1600, Math.round(longEdge))
  return box.width >= box.height
    ? { w: cap, h: Math.round((cap * box.height) / box.width) }
    : { w: Math.round((cap * box.width) / box.height), h: cap }
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Couldn't read "${file.name}".`))
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

/** Loads a data URL into an `<img>` element, resolving once it's decoded
    (needed both to measure natural dimensions and, later, to draw from). */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Couldn't read this image's dimensions."))
    img.src = src
  })
}

/** Normalizes HEIC/TIFF (via imageConversion), reads the result as a data
    URL, and measures its natural dimensions — the picker's whole "file
    picked" → "ready to crop" step. Throws a message safe to show directly
    (imageConversion's own contract; the read/measure failures here follow
    the same style). */
export async function readFileAsPendingPhoto(file: File): Promise<PendingPhoto> {
  const normalized = await normalizeImageFile(file)
  const src = await readAsDataURL(normalized)
  const img = await loadImageElement(src)
  return {
    id: 'creator-photo',
    src,
    naturalW: img.naturalWidth,
    naturalH: img.naturalHeight,
    zoom: 1,
    panX: 0,
    panY: 0,
  }
}

/**
 * Bakes the crop modal's result into a flat JPEG data URL at `{w, h}` (the
 * shape `cropCellSize` returns) — the template schema only carries
 * `photo.src` (no zoom/pan/naturalW/H, unlike `Photo`), so the pan/zoom the
 * author dialed in has to be rendered into the pixels once, here, rather
 * than stored for the coordinator app to re-apply later.
 *
 * Deliberately not a reuse of `features/export/shared.ts#preRenderPhoto`:
 * that helper hardcodes a 4x supersample (`cellW * 4`/`ctx.scale(4, 4)`),
 * which would make a `size`-px bake come out at `size * 4` px — 4x over
 * the ≤1600px-long-edge requirement. This draws at a plain 1:1 scale
 * instead, reusing only the pure cover-fit/pan-clamp math
 * (coverRect/clampPan), which both helpers share.
 */
export async function bakeCroppedPhoto(photo: PendingPhoto, crop: CropResult, { w, h }: { w: number; h: number }): Promise<string> {
  const img = await loadImageElement(photo.src)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2D context')

  // JPEG has no alpha channel — toDataURL would otherwise composite a
  // transparent PNG upload's alpha to black. Fill white first so a
  // transparent source (or any sliver coverRect doesn't fully cover)
  // lands on white instead.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)

  const rect = coverRect(photo.naturalW, photo.naturalH, w, h)
  const { x: panX, y: panY } = clampPan(photo.naturalW, photo.naturalH, w, h, crop.panX, crop.panY, crop.zoom)

  // Replicate the preview/crop-modal's CSS: translate(panX,panY)
  // scale(zoom) with transform-origin: center center.
  ctx.translate(w / 2, h / 2)
  ctx.translate(panX, panY)
  ctx.scale(crop.zoom, crop.zoom)
  ctx.translate(-w / 2, -h / 2)
  ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)

  return canvas.toDataURL('image/jpeg', 0.85)
}
