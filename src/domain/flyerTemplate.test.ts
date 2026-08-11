import { describe, it, expect } from 'vitest'
import type { FlyerColors, FlyerTemplate } from '@/types'
import {
  validateTemplate,
  makeDefaultTemplate,
  formatMonth,
  compareMonth,
  groupByMonth,
  currentMonth,
  isFieldEditable,
  emptyValues,
  pickDefaultTemplateId,
  slugify,
  layoutDetailRows,
  FLYER_FIELDS,
  FLYER_FIELD_LABELS,
  DEFAULT_PHOTO_BOX,
  resolvePhotoBox,
  paletteMatches,
} from './flyerTemplate'

// Loaded via import.meta.glob (not a static import of the config module) so
// this domain test reads the raw JSON data file without importing anything
// from `config` — see conventions brief §1 on layer direction. `node:fs`
// isn't usable here: @types/node isn't a project dependency.
const flyerTemplateModules = import.meta.glob('../config/flyerTemplates/safer-communities.json', {
  eager: true,
  import: 'default',
})
const sampleTemplate: unknown = Object.values(flyerTemplateModules)[0]

// Every bundled template file, not just the one sample above — the
// strongest possible proof that `photo.box` being optional is truly
// backward-compatible: every template actually committed to the repo (not
// a synthetic fixture) still validates, and still resolves to
// DEFAULT_PHOTO_BOX now that none of them sets a `box`.
const allBundledTemplateModules = import.meta.glob('../config/flyerTemplates/*.json', {
  eager: true,
  import: 'default',
})
const allBundledTemplates: unknown[] = Object.values(allBundledTemplateModules)

function validTemplate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    id: 'sample',
    name: 'Sample',
    month: '2026-08',
    eyebrow: 'A PRS SIGNATURE EVENT',
    headline: ['SAFER', 'COMMUNITIES'],
    subtitle: 'Working Together for a Safer Tomorrow.',
    description: 'Connect with local public safety partners.',
    photo: { src: 'data:image/jpeg;base64,abc' },
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
    editableFields: ['date', 'time', 'location', 'additionalInfo', 'rscEmail'],
    ...overrides,
  }
}

describe('validateTemplate', () => {
  it('accepts the bundled sample template', () => {
    expect(() => validateTemplate(sampleTemplate)).not.toThrow()
    const template = validateTemplate(sampleTemplate)
    expect(template.id).toBe('safer-communities')
    expect(template.headline).toEqual(['SAFER', 'COMMUNITIES'])
  })

  it('accepts a minimal hand-built valid template', () => {
    expect(() => validateTemplate(validTemplate())).not.toThrow()
  })

  it('rejects a wrong schema version, naming "v"', () => {
    expect(() => validateTemplate(validTemplate({ v: 2 }))).toThrow(TypeError)
    expect(() => validateTemplate(validTemplate({ v: 2 }))).toThrow(/\bv\b/)
  })

  it('rejects a malformed month, naming "month"', () => {
    expect(() => validateTemplate(validTemplate({ month: '2026-13' }))).toThrow(/month/)
    expect(() => validateTemplate(validTemplate({ month: '2026-8' }))).toThrow(/month/)
  })

  it('rejects an empty headline array, naming "headline"', () => {
    expect(() => validateTemplate(validTemplate({ headline: [] }))).toThrow(/headline/)
  })

  it('rejects a missing color key, naming that key', () => {
    const { heroBg, ...restColors } = validTemplate().colors as Record<string, string>
    expect(heroBg).toBeDefined() // sanity: we did remove a real key
    expect(() => validateTemplate(validTemplate({ colors: restColors }))).toThrow(/heroBg/)
  })

  it('rejects a non-numeric watermark value, naming that key', () => {
    expect(() =>
      validateTemplate(validTemplate({ watermark: { opacity: '1', scale: 1, x: 0, y: 0 } }))
    ).toThrow(/opacity/)
  })

  it('rejects an unknown entry in editableFields', () => {
    expect(() =>
      validateTemplate(validTemplate({ editableFields: ['date', 'bogus'] }))
    ).toThrow(/editableFields/)
  })

  it('rejects a duplicate entry in editableFields', () => {
    expect(() =>
      validateTemplate(validTemplate({ editableFields: ['date', 'date'] }))
    ).toThrow(/editableFields/)
  })

  it('rejects a non-object value', () => {
    expect(() => validateTemplate(null)).toThrow(TypeError)
    expect(() => validateTemplate('nope')).toThrow(TypeError)
  })

  it('rejects an empty id', () => {
    expect(() => validateTemplate(validTemplate({ id: '' }))).toThrow(/id/)
  })

  describe('photo.box (optional — backward compatibility)', () => {
    it('accepts a template with no box key at all', () => {
      expect(() => validateTemplate(validTemplate())).not.toThrow()
      expect(validateTemplate(validTemplate()).photo.box).toBeUndefined()
    })

    it('accepts a template whose photo.box is explicitly undefined', () => {
      const template = validTemplate({ photo: { src: 'x', box: undefined } })
      expect(() => validateTemplate(template)).not.toThrow()
    })

    it('accepts a present box with four finite numbers, including negative ones', () => {
      const box = { left: -50, top: -100, width: 500, height: 400 }
      const template = validTemplate({ photo: { src: 'x', box } })
      expect(() => validateTemplate(template)).not.toThrow()
      expect(validateTemplate(template).photo.box).toEqual(box)
    })

    it('rejects a non-object box, naming "box"', () => {
      const template = validTemplate({ photo: { src: 'x', box: 'nope' } })
      expect(() => validateTemplate(template)).toThrow(/photo\.box/)
    })

    it('rejects a box missing a key, naming that key', () => {
      const template = validTemplate({ photo: { src: 'x', box: { left: 0, top: 0, width: 500 } } })
      expect(() => validateTemplate(template)).toThrow(/height/)
    })

    it('rejects a box with a string value, naming that key', () => {
      const template = validTemplate({ photo: { src: 'x', box: { left: '0', top: 0, width: 500, height: 400 } } })
      expect(() => validateTemplate(template)).toThrow(/left/)
    })

    it.each(['NaN', 'Infinity', '-Infinity'])('rejects a box with %s (typeof number, but not finite)', (literal) => {
      const value = literal === 'NaN' ? NaN : literal === 'Infinity' ? Infinity : -Infinity
      const template = validTemplate({ photo: { src: 'x', box: { left: 0, top: 0, width: value, height: 400 } } })
      expect(typeof value).toBe('number') // sanity: this is exactly the case typeof alone would miss
      expect(() => validateTemplate(template)).toThrow(/width/)
    })
  })
})

describe('every bundled template (backward compatibility)', () => {
  it('found at least one bundled template to check', () => {
    // Guards the glob pattern itself — a typo there would make every
    // assertion below vacuously pass over zero templates.
    expect(allBundledTemplates.length).toBeGreaterThan(0)
  })

  it('every bundled template file validates as-is', () => {
    for (const raw of allBundledTemplates) {
      expect(() => validateTemplate(raw)).not.toThrow()
    }
  })

  it('none of them has a photo.box (none existed before this field did)', () => {
    for (const raw of allBundledTemplates) {
      const template = validateTemplate(raw)
      expect(template.photo.box).toBeUndefined()
    }
  })

  it('resolvePhotoBox falls back to DEFAULT_PHOTO_BOX for every one of them', () => {
    for (const raw of allBundledTemplates) {
      const template = validateTemplate(raw)
      expect(resolvePhotoBox(template)).toEqual(DEFAULT_PHOTO_BOX)
    }
  })
})

describe('resolvePhotoBox', () => {
  it("returns DEFAULT_PHOTO_BOX when the template hasn't set its own box", () => {
    const template = validateTemplate(validTemplate())
    expect(resolvePhotoBox(template)).toEqual(DEFAULT_PHOTO_BOX)
  })

  it('returns the template’s own box when it set one, not the default', () => {
    const box = { left: 10, top: 20, width: 300, height: 250 }
    const template = validateTemplate(validTemplate({ photo: { src: 'x', box } }))
    expect(resolvePhotoBox(template)).toEqual(box)
    expect(resolvePhotoBox(template)).not.toEqual(DEFAULT_PHOTO_BOX)
  })
})

describe('paletteMatches', () => {
  const palette: FlyerColors = {
    heroBg: '#2259A9',
    heroPattern: '#4574B7',
    accent: '#EFDA87',
    ring: '#0E97C3',
    subtitle: '#2259A9',
    iconCircle: '#2259A9',
    bodyText: '#262626',
    footerBg: '#2259A9',
  }

  it('is true when every one of the eight keys matches, case-insensitively', () => {
    const colors: FlyerColors = { ...palette, heroBg: palette.heroBg.toLowerCase() }
    expect(paletteMatches(colors, palette)).toBe(true)
  })

  it('is false when exactly one of the eight keys differs', () => {
    const colors: FlyerColors = { ...palette, accent: '#ffffff' }
    expect(paletteMatches(colors, palette)).toBe(false)
  })
})

describe('formatMonth', () => {
  it('formats a couple of months', () => {
    expect(formatMonth('2026-08')).toBe('August 2026')
    expect(formatMonth('2027-01')).toBe('January 2027')
  })

  it('throws on a malformed month', () => {
    expect(() => formatMonth('2026-13')).toThrow(TypeError)
  })
})

describe('compareMonth', () => {
  it('orders ascending across a year boundary', () => {
    const months = ['2027-01', '2026-12', '2026-08']
    expect([...months].sort(compareMonth)).toEqual(['2026-08', '2026-12', '2027-01'])
  })
})

describe('groupByMonth', () => {
  const t = (overrides: Partial<FlyerTemplate>): FlyerTemplate =>
    validateTemplate(validTemplate({ ...overrides }))

  it('groups by month, orders groups ascending, and orders within a group by name', () => {
    const templates = [
      t({ id: 'b', name: 'Bravo', month: '2026-12' }),
      t({ id: 'a', name: 'Alpha', month: '2026-08' }),
      t({ id: 'c', name: 'Charlie', month: '2026-08' }),
    ]
    const groups = groupByMonth(templates)
    expect(groups.map((g) => g.month)).toEqual(['2026-08', '2026-12'])
    expect(groups[0].label).toBe('August 2026')
    expect(groups[0].templates.map((tpl) => tpl.name)).toEqual(['Alpha', 'Charlie'])
    expect(groups[1].templates.map((tpl) => tpl.name)).toEqual(['Bravo'])
  })
})

describe('currentMonth', () => {
  it('returns YYYY-MM for an injected local date', () => {
    // Local noon avoids any UTC-offset edge case shifting the calendar day.
    expect(currentMonth(new Date(2026, 7, 10, 12, 0, 0))).toBe('2026-08')
  })

  it('zero-pads single-digit months', () => {
    expect(currentMonth(new Date(2026, 0, 1, 12, 0, 0))).toBe('2026-01')
  })
})

describe('isFieldEditable', () => {
  it('is true for a field listed in editableFields', () => {
    const template = validateTemplate(validTemplate({ editableFields: ['date'] }))
    expect(isFieldEditable(template, 'date')).toBe(true)
  })

  it('is false for a field not listed in editableFields', () => {
    const template = validateTemplate(validTemplate({ editableFields: ['date'] }))
    expect(isFieldEditable(template, 'time')).toBe(false)
  })
})

describe('emptyValues', () => {
  it('returns all five fields as empty strings', () => {
    expect(emptyValues()).toEqual({
      date: '',
      time: '',
      location: '',
      additionalInfo: '',
      rscEmail: '',
    })
  })
})

describe('makeDefaultTemplate', () => {
  it('passes validateTemplate', () => {
    expect(() => validateTemplate(makeDefaultTemplate())).not.toThrow()
  })

  it('passes validateTemplate even though its photo.src is empty', () => {
    // A photo-less template is structurally valid — the creator starts from
    // this default and must be able to round-trip it through the validator
    // before a photo has been chosen.
    expect(makeDefaultTemplate().photo.src).toBe('')
    expect(() => validateTemplate(makeDefaultTemplate())).not.toThrow()
  })

  it('uses the current month from the injected date', () => {
    const template = makeDefaultTemplate(new Date(2026, 7, 10, 12, 0, 0))
    expect(template.month).toBe('2026-08')
  })

  it('has an empty photo.src and all five editableFields', () => {
    const template = makeDefaultTemplate()
    expect(template.photo.src).toBe('')
    expect(template.editableFields).toEqual(['date', 'time', 'location', 'additionalInfo', 'rscEmail'])
  })

  it('has the default watermark', () => {
    const template = makeDefaultTemplate()
    expect(template.watermark).toEqual({ opacity: 1, scale: 1, x: 0, y: 0 })
  })
})

describe('pickDefaultTemplateId', () => {
  // Sorted by month ascending, as `flyerTemplates` is.
  const templates = [
    validTemplate({ id: 'jun', month: '2026-06' }),
    validTemplate({ id: 'aug', month: '2026-08' }),
    validTemplate({ id: 'dec', month: '2026-12' }),
  ].map((t) => validateTemplate(t))

  it('returns the template for the current month when one exists', () => {
    expect(pickDefaultTemplateId(templates, new Date(2026, 7, 15))).toBe('aug')
  })

  it('falls back to the most recent template not in the future', () => {
    // September: no September template, so August rather than December.
    expect(pickDefaultTemplateId(templates, new Date(2026, 8, 1))).toBe('aug')
    // The following January: December is the most recent.
    expect(pickDefaultTemplateId(templates, new Date(2027, 0, 20))).toBe('dec')
  })

  it('falls back to the first template when every one is in the future', () => {
    expect(pickDefaultTemplateId(templates, new Date(2026, 0, 5))).toBe('jun')
  })

  it('returns an empty string when there are no templates', () => {
    expect(pickDefaultTemplateId([], new Date(2026, 7, 15))).toBe('')
  })
})

describe('layoutDetailRows', () => {
  it('places date/time as slot 1 columns, then location at slot 2, then additionalInfo at slot 3, when all are editable', () => {
    const rows = layoutDetailRows(['date', 'time', 'location', 'additionalInfo', 'rscEmail'])
    expect(rows).toEqual([
      { field: 'date', top: 583, left: 82 },
      { field: 'time', top: 583, left: 416 },
      { field: 'location', top: 667, left: 82 },
      { field: 'additionalInfo', top: 752, left: 82 },
    ])
  })

  it('moves additionalInfo from slot 3 to slot 2 when location is hidden', () => {
    const rows = layoutDetailRows(['date', 'time', 'additionalInfo'])
    expect(rows).toEqual([
      { field: 'date', top: 583, left: 82 },
      { field: 'time', top: 583, left: 416 },
      { field: 'additionalInfo', top: 667, left: 82 },
    ])
  })

  it('moves location to slot 1 and additionalInfo to slot 2 when both date and time are hidden', () => {
    const rows = layoutDetailRows(['location', 'additionalInfo'])
    expect(rows).toEqual([
      { field: 'location', top: 583, left: 82 },
      { field: 'additionalInfo', top: 667, left: 82 },
    ])
  })

  it('fills the left column with time when date is not editable', () => {
    const rows = layoutDetailRows(['time', 'location'])
    expect(rows).toEqual([
      { field: 'time', top: 583, left: 82 },
      { field: 'location', top: 667, left: 82 },
    ])
  })

  it('fills the left column with date when time is not editable', () => {
    const rows = layoutDetailRows(['date', 'location'])
    expect(rows).toEqual([
      { field: 'date', top: 583, left: 82 },
      { field: 'location', top: 667, left: 82 },
    ])
  })

  it('leaves slot 1 unused, with nothing shifting up, when only additionalInfo is editable', () => {
    const rows = layoutDetailRows(['additionalInfo'])
    expect(rows).toEqual([{ field: 'additionalInfo', top: 583, left: 82 }])
  })

  it('is unaffected by rscEmail, which the footer handles independently', () => {
    expect(layoutDetailRows(['rscEmail'])).toEqual([])
  })

  it('returns no rows when nothing is editable', () => {
    expect(layoutDetailRows([])).toEqual([])
  })
})

describe('FLYER_FIELDS / FLYER_FIELD_LABELS', () => {
  it('has a label for every field, in the fixed field order', () => {
    expect(FLYER_FIELDS).toEqual(['date', 'time', 'location', 'additionalInfo', 'rscEmail'])
    for (const field of FLYER_FIELDS) {
      expect(typeof FLYER_FIELD_LABELS[field]).toBe('string')
      expect(FLYER_FIELD_LABELS[field].length).toBeGreaterThan(0)
    }
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates a normal title', () => {
    expect(slugify('Safer Communities')).toBe('safer-communities')
  })

  it('collapses runs of punctuation/whitespace into one hyphen', () => {
    expect(slugify('Winter  Safety --- Fair!')).toBe('winter-safety-fair')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -Holiday Block Party- ')).toBe('holiday-block-party')
  })

  it('returns an empty string for an empty or all-punctuation name', () => {
    expect(slugify('')).toBe('')
    expect(slugify('!!!')).toBe('')
  })
})
