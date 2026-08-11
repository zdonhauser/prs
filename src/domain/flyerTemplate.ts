// Pure flyer-template helpers: validation, defaults, and month grouping.
// No React, no DOM, no browser APIs — see conventions brief §1.

import type { DetailField, FlyerColors, FlyerField, FlyerTemplate, FooterField, PhotoBox } from '@/types'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

const COLOR_KEYS: Array<keyof FlyerColors> = [
  'heroBg',
  'heroPattern',
  'accent',
  'ring',
  'subtitle',
  'iconCircle',
  'bodyText',
  'footerBg',
]

// The fixed field order every form/checklist in the suite presents fields
// in — exported so FlyerFormPanel, CreatorPanel and CreatorApp share one
// list instead of each keeping its own verbatim copy. The last three
// (phone/address/website) joined rscEmail as footer fields; they render
// only when both editable AND non-blank (see `layoutFooterFields`), unlike
// the four detail-row fields before them, which show a blank label instead
// (see `layoutDetailRows`).
export const FLYER_FIELDS: readonly FlyerField[] = [
  'date',
  'time',
  'location',
  'additionalInfo',
  'rscEmail',
  'phone',
  'address',
  'website',
]

/** Display labels for the eight flyer fields, shared by the same three call sites as `FLYER_FIELDS`. */
export const FLYER_FIELD_LABELS: Record<FlyerField, string> = {
  date: 'Date',
  time: 'Time',
  location: 'Location',
  additionalInfo: 'Additional Information',
  rscEmail: 'RSC Email',
  phone: 'Phone',
  address: 'Address',
  website: 'Website',
}

/**
 * The photo bubble's default bounding box, in page px on the 816×1056
 * basis — used whenever a template omits `photo.box` (every template
 * committed before this field existed, plus any new one an author hasn't
 * touched the shape controls on).
 *
 * A wide ellipse, not a circle: tuned against the hi-res reference
 * (`<scratchpad>/ref/flyer-hi.png`) by rendering, then measuring where the
 * teal ring falls on its two visible arcs (left, bottom — the ring runs off
 * the top and right page edges, so those aren't comparable) against the
 * reference's own ring, and iterating. Converged to a left-arc delta of
 * +1.6px mean / 7px max and a bottom-arc delta of −0.6px mean / 3px max
 * (26 and 8 sample scanlines respectively, skipping any row the reference's
 * or the render's own headline text occludes on either side). See
 * task-7-report.md for the full measurement.
 */
export const DEFAULT_PHOTO_BOX: PhotoBox = { left: 401, top: -32, width: 535, height: 438 }

/**
 * The colors `makeDefaultTemplate` starts a new template from — also the
 * baseline the creator's "Advanced color options" disclosure compares
 * against to decide whether to show its "Modified" marker: a fresh
 * template shouldn't read as modified before its author has touched
 * anything, even though these values don't happen to equal any single
 * entry in `flyerPalettes` (they predate the palette picker).
 */
export const DEFAULT_COLORS: FlyerColors = {
  heroBg: '#2259a9',
  heroPattern: '#4372b6',
  accent: '#efda87',
  ring: '#0e97c3',
  subtitle: '#2259a9',
  iconCircle: '#2259a9',
  bodyText: '#262626',
  footerBg: '#2259a9',
}

/**
 * The watermark settings `makeDefaultTemplate` starts a new template from —
 * also the baseline the creator's "Watermark" disclosure compares against
 * for its own "Modified" marker.
 */
export const DEFAULT_WATERMARK: FlyerTemplate['watermark'] = { opacity: 1, scale: 1, x: 0, y: 0 }

/**
 * Resolves a template to its *effective* photo box — the template's own
 * `photo.box` if it set one, else `DEFAULT_PHOTO_BOX`. The one place
 * `FlyerCanvas` and `exportFlyerPdf` both go through, so the default only
 * ever needs to change in one place.
 */
export function resolvePhotoBox(template: FlyerTemplate): PhotoBox {
  return template.photo.box ?? DEFAULT_PHOTO_BOX
}

/**
 * Whether `colors` matches every one of a palette's eight values —
 * case-insensitively, since a hex typed or set programmatically can differ
 * only in letter case from the same color. Used by the creator's palette
 * picker to show which (if any) coordinated scheme is currently active.
 */
export function paletteMatches(colors: FlyerColors, palette: FlyerColors): boolean {
  return COLOR_KEYS.every(key => colors[key].toLowerCase() === palette[key].toLowerCase())
}

function isFlyerField(value: string): value is FlyerField {
  return (FLYER_FIELDS as readonly string[]).includes(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Narrows unknown JSON to a `FlyerTemplate`, throwing a `TypeError` naming
 * the first offending field on any mismatch. Check order mirrors the plan's
 * schema field order.
 */
export function validateTemplate(value: unknown): FlyerTemplate {
  if (!isPlainObject(value)) {
    throw new TypeError('FlyerTemplate must be an object')
  }

  if (value.v !== 1) {
    throw new TypeError(`FlyerTemplate.v must be 1, got ${JSON.stringify(value.v)}`)
  }

  if (typeof value.id !== 'string' || value.id === '') {
    throw new TypeError('FlyerTemplate.id must be a non-empty string')
  }

  if (typeof value.name !== 'string' || value.name === '') {
    throw new TypeError('FlyerTemplate.name must be a non-empty string')
  }

  if (typeof value.eyebrow !== 'string') {
    throw new TypeError('FlyerTemplate.eyebrow must be a string')
  }

  if (typeof value.subtitle !== 'string') {
    throw new TypeError('FlyerTemplate.subtitle must be a string')
  }

  if (typeof value.description !== 'string') {
    throw new TypeError('FlyerTemplate.description must be a string')
  }

  if (typeof value.month !== 'string' || !MONTH_RE.test(value.month)) {
    throw new TypeError(`FlyerTemplate.month must match 'YYYY-MM', got ${JSON.stringify(value.month)}`)
  }

  if (
    !Array.isArray(value.headline) ||
    value.headline.length === 0 ||
    !value.headline.every((entry) => typeof entry === 'string')
  ) {
    throw new TypeError('FlyerTemplate.headline must be a non-empty array of strings')
  }

  // An empty src is valid: the flyer renders the photo circle with no image,
  // and that is the state a template sits in while the creator is still
  // being filled in. A committed template without a photo is a content
  // mistake, not a structural one.
  if (!isPlainObject(value.photo) || typeof value.photo.src !== 'string') {
    throw new TypeError('FlyerTemplate.photo.src must be a string')
  }

  // `box` is optional — every template committed before this field existed
  // (and the bundled sample) has no `box` key at all, and must keep
  // validating and rendering exactly as it did (via DEFAULT_PHOTO_BOX,
  // below). `undefined` is accepted the same way whether the key is
  // entirely absent or present-but-undefined, so a value reset by deleting
  // the key and one reset by assigning `undefined` both pass identically.
  // A *present* box, though, must be four finite numbers — Number.isFinite
  // rather than typeof, so NaN/Infinity (both `typeof === 'number'`) are
  // still rejected.
  if (value.photo.box !== undefined) {
    if (!isPlainObject(value.photo.box)) {
      throw new TypeError('FlyerTemplate.photo.box must be an object')
    }
    for (const key of ['left', 'top', 'width', 'height'] as const) {
      if (typeof value.photo.box[key] !== 'number' || !Number.isFinite(value.photo.box[key])) {
        throw new TypeError(`FlyerTemplate.photo.box.${key} must be a finite number`)
      }
    }
  }

  if (!isPlainObject(value.colors)) {
    throw new TypeError('FlyerTemplate.colors must be an object')
  }
  for (const key of COLOR_KEYS) {
    if (typeof value.colors[key] !== 'string') {
      throw new TypeError(`FlyerTemplate.colors.${key} must be a string`)
    }
  }

  if (!isPlainObject(value.watermark)) {
    throw new TypeError('FlyerTemplate.watermark must be an object')
  }
  for (const key of ['opacity', 'scale', 'x', 'y'] as const) {
    if (typeof value.watermark[key] !== 'number') {
      throw new TypeError(`FlyerTemplate.watermark.${key} must be a number`)
    }
  }

  if (!Array.isArray(value.editableFields)) {
    throw new TypeError('FlyerTemplate.editableFields must be an array')
  }
  const seen = new Set<string>()
  for (const entry of value.editableFields) {
    if (typeof entry !== 'string' || !isFlyerField(entry)) {
      throw new TypeError(`FlyerTemplate.editableFields contains an invalid entry: ${JSON.stringify(entry)}`)
    }
    if (seen.has(entry)) {
      throw new TypeError(`FlyerTemplate.editableFields contains a duplicate entry: ${JSON.stringify(entry)}`)
    }
    seen.add(entry)
  }

  // Every field has been checked above; the remaining gap is structural
  // (extra unknown properties on `value`), which is harmless to carry.
  return value as unknown as FlyerTemplate
}

/**
 * A blank starting template for the template creator. `id`/`name` are
 * non-empty placeholders (validateTemplate requires both to be non-empty,
 * unlike the other text fields) meant to be overwritten immediately by the
 * creator UI; every other text field is genuinely empty, including
 * `headline`, which keeps a single empty-string entry since the schema
 * requires a non-empty array.
 */
export function makeDefaultTemplate(now: Date = new Date()): FlyerTemplate {
  return {
    v: 1,
    id: 'untitled',
    name: 'Untitled Template',
    month: currentMonth(now),
    eyebrow: '',
    headline: [''],
    subtitle: '',
    description: '',
    photo: { src: '' },
    colors: { ...DEFAULT_COLORS },
    watermark: { ...DEFAULT_WATERMARK },
    editableFields: [...FLYER_FIELDS],
  }
}

/** `'2026-08'` → `'August 2026'`. Throws a `TypeError` on a malformed month. */
export function formatMonth(month: string): string {
  if (!MONTH_RE.test(month)) {
    throw new TypeError(`month must match 'YYYY-MM', got ${JSON.stringify(month)}`)
  }
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Ascending sort comparator for 'YYYY-MM' strings. */
export function compareMonth(a: string, b: string): number {
  return a === b ? 0 : a < b ? -1 : 1
}

/** Groups templates by month, months ascending, templates within a group sorted by name. */
export function groupByMonth(
  templates: FlyerTemplate[]
): Array<{ month: string; label: string; templates: FlyerTemplate[] }> {
  const groups = new Map<string, FlyerTemplate[]>()
  for (const template of templates) {
    const bucket = groups.get(template.month)
    if (bucket) {
      bucket.push(template)
    } else {
      groups.set(template.month, [template])
    }
  }

  return Array.from(groups.entries())
    .sort((a, b) => compareMonth(a[0], b[0]))
    .map(([month, group]) => ({
      month,
      label: formatMonth(month),
      templates: [...group].sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

/** 'YYYY-MM' for the given/current date, in local time. */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function isFieldEditable(template: FlyerTemplate, field: FlyerField): boolean {
  return template.editableFields.includes(field)
}

/** A detail-row field placed at one of the flyer's three fixed slot positions (flyer.css's measured top/left values). */
export interface DetailRowPlacement {
  field: DetailField
  top: number
  left: number
}

// The three detail-row slots' fixed top positions (flyer.css:241-244's
// measured values, kept here as the one source layoutDetailRows computes
// from — FlyerCanvas applies them as inline style rather than per-field CSS
// classes, since which field lands in which slot now depends on
// `editableFields`, not on the field's own identity).
const DETAIL_SLOT_TOPS = [583, 667, 752] as const
const DETAIL_LEFT_COL = 82
const DETAIL_RIGHT_COL = 416

/**
 * Assigns the visible detail-row fields (everything but `rscEmail`, which
 * the footer handles independently) to the flyer's three fixed slots,
 * closing up any row a hidden field would otherwise leave blank.
 *
 * `date` and `time` share slot 1 as two columns: whichever of the two is
 * editable fills the left column first, the other the right; if neither is
 * editable, slot 1 goes unused. `location`, then `additionalInfo`, each then
 * claim the next free slot in that order, skipped entirely when not
 * editable. So hiding `location` alone moves `additionalInfo` from slot 3
 * to slot 2; hiding both `date` and `time` moves `location` to slot 1 and
 * `additionalInfo` to slot 2.
 */
export function layoutDetailRows(editableFields: readonly FlyerField[]): DetailRowPlacement[] {
  const editable = new Set(editableFields)
  const rows: DetailRowPlacement[] = []
  let slot = 0

  const dateVisible = editable.has('date')
  const timeVisible = editable.has('time')
  if (dateVisible || timeVisible) {
    const top = DETAIL_SLOT_TOPS[slot]
    slot++
    const columns: Array<'date' | 'time'> = []
    if (dateVisible) columns.push('date')
    if (timeVisible) columns.push('time')
    rows.push({ field: columns[0], top, left: DETAIL_LEFT_COL })
    if (columns[1]) rows.push({ field: columns[1], top, left: DETAIL_RIGHT_COL })
  }

  for (const field of ['location', 'additionalInfo'] as const) {
    if (editable.has(field)) {
      rows.push({ field, top: DETAIL_SLOT_TOPS[slot], left: DETAIL_LEFT_COL })
      slot++
    }
  }

  return rows
}

/** The footer's four fields, in the fixed order they're offered/rendered in. */
export const FOOTER_FIELDS: readonly FooterField[] = ['rscEmail', 'phone', 'address', 'website']

/** A footer field placed at one line of the footer's contact block. */
export interface FooterRowPlacement {
  field: FooterField
  top: number
  /** True once a second (or later) row pushes every row onto the compact,
      smaller-type layout — see `layoutFooterFields`'s own comment. */
  compact: boolean
}

// A single row sits exactly where it always has (flyer.css's own
// .flyer-footer-label default: top 26px, 15px type) — this constant exists
// so `layoutFooterFields` can still hand every row an explicit `top` even
// in the single-row case, without that top value drifting from the CSS
// default it's meant to match. Left is unchanged for every row (220px,
// still in flyer.css) since no field is ever wide enough to need a second
// column the way date/time share one in the detail rows.
const FOOTER_ROW_TOP_SINGLE = 26

// Two or more rows switch to smaller, tighter-leaded type so up to all four
// fields stack inside the footer's 115px band without crowding the logo's
// own vertical center or running past the band's bottom edge. Measured
// against the footer's own geometry, not the reference (the reference has
// no multi-field footer to measure against): 4 rows × 17px = 68px, starting
// at top 20px, ends at 88px — comfortably inside 115px on both ends.
const FOOTER_ROW_TOP_MULTI = 20
const FOOTER_ROW_LINE_HEIGHT_MULTI = 17

/**
 * Assigns the visible footer fields to lines in the footer's contact block,
 * in `FOOTER_FIELDS` order, closing up any gap a hidden or blank field
 * would otherwise leave.
 *
 * `rscEmail` is visible whenever it's editable, blank or not — matching the
 * reference's blank state (`RSC EMAIL:` with no value) and every template
 * committed before this function existed, none of which lists any of the
 * other three fields. `phone`/`address`/`website` are new: they have no
 * "blank" print state of their own (no reference to match, and a bare
 * `PHONE:`/`ADDRESS:`/`WEBSITE:` label with nothing after it would just be
 * clutter), so each is visible only when it's both editable AND has a
 * value — same rule `editableFields` + a value already gives every other
 * hide-when-blank field in this file.
 *
 * One visible row keeps the original single-line position/size untouched
 * (`compact: false`) so a template using only `rscEmail` — every template
 * committed so far — renders byte-identically to before this function
 * existed. Two or more switch every row to the compact stacked layout.
 */
export function layoutFooterFields(
  editableFields: readonly FlyerField[],
  values: Record<FlyerField, string>
): FooterRowPlacement[] {
  const editable = new Set(editableFields)
  const visible = FOOTER_FIELDS.filter(field => {
    if (!editable.has(field)) return false
    if (field === 'rscEmail') return true
    return values[field] !== ''
  })

  if (visible.length <= 1) {
    return visible.map(field => ({ field, top: FOOTER_ROW_TOP_SINGLE, compact: false }))
  }

  return visible.map((field, i) => ({
    field,
    top: FOOTER_ROW_TOP_MULTI + i * FOOTER_ROW_LINE_HEIGHT_MULTI,
    compact: true,
  }))
}

/**
 * Picks the template a coordinator should land on: one for the current month
 * if it exists, else the most recent one not in the future, else the first.
 * `''` when there are none.
 *
 * `templates` is expected sorted by month ascending, as `flyerTemplates` is.
 *
 * This lives here, taking its inputs as arguments, so all three branches can
 * be tested. Its caller in `config/` reads a module-level list baked in at
 * import time, which only ever exercises whichever branch today's date and
 * the currently bundled templates happen to select.
 */
export function pickDefaultTemplateId(templates: FlyerTemplate[], now: Date = new Date()): string {
  if (templates.length === 0) return ''

  const current = currentMonth(now)
  const exactMatch = templates.find((template) => template.month === current)
  if (exactMatch) return exactMatch.id

  const notFuture = templates.filter((template) => compareMonth(template.month, current) <= 0)
  if (notFuture.length > 0) return notFuture[notFuture.length - 1].id

  return templates[0].id
}

/**
 * Derives a template `id` from its `name` — used by the template creator so
 * typing a name fills in a matching id/filename without the author typing
 * both. Lowercases, collapses runs of non-alphanumerics to a single '-',
 * and trims leading/trailing '-'. Pure and total: `''` in, `''` out (the
 * caller falls back to a placeholder, the same one `makeDefaultTemplate`
 * uses, rather than this function inventing one).
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** All eight flyer fields, defaulted to empty strings. */
export function emptyValues(): Record<FlyerField, string> {
  return {
    date: '',
    time: '',
    location: '',
    additionalInfo: '',
    rscEmail: '',
    phone: '',
    address: '',
    website: '',
  }
}
