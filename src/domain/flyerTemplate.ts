// Pure flyer-template helpers: validation, defaults, and month grouping.
// No React, no DOM, no browser APIs — see conventions brief §1.

import type { FlyerColors, FlyerField, FlyerTemplate } from '@/types'

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

const FLYER_FIELDS: readonly FlyerField[] = ['date', 'time', 'location', 'additionalInfo', 'rscEmail']

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
    colors: {
      heroBg: '#2259a9',
      heroPattern: '#4372b6',
      accent: '#efda87',
      ring: '#0e97c3',
      subtitle: '#2259a9',
      iconCircle: '#2259a9',
      bodyText: '#262626',
      footerBg: '#2259a9',
    },
    watermark: { opacity: 1, scale: 1, x: 0, y: 0 },
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

/** All five flyer fields, defaulted to empty strings. */
export function emptyValues(): Record<FlyerField, string> {
  return {
    date: '',
    time: '',
    location: '',
    additionalInfo: '',
    rscEmail: '',
  }
}
