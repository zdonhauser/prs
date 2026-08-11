// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadSavedForm,
  saveForm,
  clearSavedForm,
  loadVersioned,
  saveVersioned,
  clearVersioned,
  loadSavedFlyerForm,
  saveFlyerForm,
  clearSavedFlyerForm,
} from './storage'
import type { StoryForm, Photo, FlyerForm } from '@/types'
import { emptyValues } from '@/domain/flyerTemplate'

const KEY = 'prs-success-story-form'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('storage', () => {
  it('round-trips a form object', () => {
    saveForm({ community: 'Oak Ridge', narrative: 'A story', photos: [] } as Partial<StoryForm> as StoryForm)
    expect(loadSavedForm()).toEqual({ community: 'Oak Ridge', narrative: 'A story', photos: [] })
  })

  it('returns null when nothing is saved', () => {
    expect(loadSavedForm()).toBeNull()
  })

  it('returns null on corrupt JSON instead of throwing', () => {
    localStorage.setItem(KEY, '{not json')
    expect(loadSavedForm()).toBeNull()
  })

  it('drops photos (keeps text) when the first write throws quota errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    saveForm({ community: 'Oak Ridge', photos: [{ id: 'p1', src: 'data:image/jpeg;base64,xxxx' } as Photo] } as Partial<StoryForm> as StoryForm)
    expect(loadSavedForm()).toEqual({ community: 'Oak Ridge', photos: [] })
  })

  it('gives up silently when every write throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => saveForm({ community: 'X', photos: [] } as Partial<StoryForm> as StoryForm)).not.toThrow()
  })

  it('clearSavedForm removes the entry', () => {
    saveForm({ community: 'X', photos: [] } as Partial<StoryForm> as StoryForm)
    clearSavedForm()
    expect(loadSavedForm()).toBeNull()
  })
})

describe('schema versioning', () => {
  it('stores an envelope with a schema version', () => {
    saveForm({ community: 'X', photos: [] } as Partial<StoryForm> as StoryForm)
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual({ v: 1, form: { community: 'X', photos: [] } })
  })

  it('accepts a legacy (pre-versioning) bare form payload', () => {
    localStorage.setItem(KEY, JSON.stringify({ community: 'Oak Ridge', photos: [] }))
    expect(loadSavedForm()).toEqual({ community: 'Oak Ridge', photos: [] })
  })

  it('rejects payloads with an unknown schema version', () => {
    localStorage.setItem(KEY, JSON.stringify({ v: 99, form: { community: 'X' } }))
    expect(loadSavedForm()).toBeNull()
  })
})

describe('generic versioned-envelope helpers', () => {
  it('round-trips a value under an arbitrary key and data field name', () => {
    saveVersioned('some-other-key', 1, 'payload', { a: 1, b: 'two' })
    expect(loadVersioned('some-other-key', 1, 'payload')).toEqual({ a: 1, b: 'two' })
  })

  it('stores the envelope under the given data key, not a fixed one', () => {
    saveVersioned('some-other-key', 1, 'widget', { name: 'X' })
    expect(JSON.parse(localStorage.getItem('some-other-key') as string)).toEqual({ v: 1, widget: { name: 'X' } })
  })

  it('returns null when nothing is saved at the key', () => {
    expect(loadVersioned('unused-key', 1, 'payload')).toBeNull()
  })

  it('returns null on corrupt JSON instead of throwing', () => {
    localStorage.setItem('some-other-key', '{not json')
    expect(loadVersioned('some-other-key', 1, 'payload')).toBeNull()
  })

  it('rejects a mismatched schema version', () => {
    saveVersioned('some-other-key', 1, 'payload', { a: 1 })
    expect(loadVersioned('some-other-key', 2, 'payload')).toBeNull()
  })

  it('accepts a legacy payload via the predicate when the version check fails', () => {
    localStorage.setItem('legacy-key', JSON.stringify({ old: true }))
    expect(loadVersioned('legacy-key', 1, 'payload', parsed => !!parsed && typeof parsed === 'object' && 'old' in parsed)).toEqual({ old: true })
  })

  it('retries with the fallback value when the first write throws, and keeps it on load', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    saveVersioned('some-other-key', 1, 'payload', { big: 'data' }, { big: '' })
    expect(loadVersioned('some-other-key', 1, 'payload')).toEqual({ big: '' })
  })

  it('gives up silently with no fallback and every write throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => saveVersioned('some-other-key', 1, 'payload', { x: 1 })).not.toThrow()
  })

  it('clearVersioned removes the entry', () => {
    saveVersioned('some-other-key', 1, 'payload', { a: 1 })
    clearVersioned('some-other-key')
    expect(loadVersioned('some-other-key', 1, 'payload')).toBeNull()
  })
})

describe('event-flyer form persistence', () => {
  const FLYER_KEY = 'prs-event-flyer-form'

  it('round-trips a flyer form object', () => {
    const form: FlyerForm = { templateId: 'safer-communities', values: { ...emptyValues(), date: 'Aug 12', time: '10am', location: 'Park' } }
    saveFlyerForm(form)
    expect(loadSavedFlyerForm()).toEqual(form)
  })

  it('returns null when nothing is saved', () => {
    expect(loadSavedFlyerForm()).toBeNull()
  })

  it('stores an envelope with a schema version under its own key', () => {
    const form: FlyerForm = { templateId: 't1', values: emptyValues() }
    saveFlyerForm(form)
    expect(JSON.parse(localStorage.getItem(FLYER_KEY) as string)).toEqual({ v: 1, form })
  })

  it('clearSavedFlyerForm removes the entry', () => {
    saveFlyerForm({ templateId: 't1', values: emptyValues() })
    clearSavedFlyerForm()
    expect(loadSavedFlyerForm()).toBeNull()
  })

  it('does not collide with the success-story form key', () => {
    saveForm({ community: 'Oak Ridge', photos: [] } as Partial<StoryForm> as StoryForm)
    saveFlyerForm({ templateId: 't1', values: emptyValues() })
    expect(loadSavedForm()).toEqual({ community: 'Oak Ridge', photos: [] })
    expect(loadSavedFlyerForm()).toEqual({ templateId: 't1', values: emptyValues() })
  })
})
