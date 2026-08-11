import type { FlyerForm, StoryForm } from '@/types'

// ─────────────────────────────────────────────────────────────────────────
// Generic versioned-envelope helpers.
//
// Every form this app persists is stored as one JSON object under its own
// localStorage key, shaped `{ v: <version>, [dataKey]: <value> }`. This
// section is only the plumbing around that shape — parsing, version
// gating, legacy-payload fallback, quota-retry, and giving up silently on
// failure — never anything about what the value itself looks like. The
// story form's functions below are thin wrappers over these; the flyer
// form's functions (in this same file) are the second, generic-by-design
// consumer.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Reads a versioned envelope from `storageKey` and returns the value stored
 * under `dataKey`, or `null` if nothing is saved, the JSON is corrupt, or
 * the envelope's `v` doesn't match `version`. Never throws.
 *
 * `isLegacyPayload`, if given, is checked when the `v` match fails — pass a
 * predicate that recognizes a pre-versioning payload shape to accept it as
 * `parsed` itself (see `loadSavedForm`'s legacy branch for the one existing
 * use of this).
 */
export function loadVersioned<T>(
  storageKey: string,
  version: number,
  dataKey: string,
  isLegacyPayload?: (parsed: unknown) => boolean
): Partial<T> | null {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).v === version) {
      return (parsed as Record<string, unknown>)[dataKey] as Partial<T>
    }
    if (isLegacyPayload?.(parsed)) return parsed as Partial<T>
    return null
  } catch {
    return null
  }
}

/**
 * Writes `value` to `storageKey` as `{ v: version, [dataKey]: value }`. If
 * the write throws (e.g. quota exceeded) and `fallbackValue` is given,
 * retries once with that instead (the story form uses this to drop photos
 * but keep the typed text); if that also throws, or no fallback was given,
 * gives up silently — persistence is a nice-to-have, not critical.
 */
export function saveVersioned<T>(storageKey: string, version: number, dataKey: string, value: T, fallbackValue?: T): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ v: version, [dataKey]: value }))
  } catch {
    if (fallbackValue === undefined) return
    try {
      localStorage.setItem(storageKey, JSON.stringify({ v: version, [dataKey]: fallbackValue }))
    } catch {
      // Persistence is a nice-to-have, not critical — give up silently.
    }
  }
}

export function clearVersioned(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // ignore
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Success-story form persistence.
// ─────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'prs-success-story-form'
const SCHEMA_VERSION = 1

// Legacy (pre-versioning) payloads were the bare form object. Accept them
// so nobody loses an in-flight draft; the next save rewrites in the
// current envelope.
function isLegacyStoryPayload(parsed: unknown): boolean {
  return !!parsed && typeof parsed === 'object' && (parsed as Record<string, unknown>).v === undefined && 'community' in (parsed as Record<string, unknown>)
}

export function loadSavedForm(): Partial<StoryForm> | null {
  return loadVersioned<StoryForm>(STORAGE_KEY, SCHEMA_VERSION, 'form', isLegacyStoryPayload)
}

export function saveForm(form: StoryForm): void {
  // Likely quota exceeded from base64 photo data — retry without photos so
  // the text fields (which are what people actually lose typing) survive.
  saveVersioned(STORAGE_KEY, SCHEMA_VERSION, 'form', form, { ...form, photos: [] })
}

export function clearSavedForm(): void {
  clearVersioned(STORAGE_KEY)
}

// ─────────────────────────────────────────────────────────────────────────
// Event-flyer form persistence. No legacy payload to accept — this key
// didn't exist before schema version 1. The values object is a handful of
// short strings (no photo data — the photo lives in the template, not the
// coordinator's form), so there's no quota-retry fallback to give either.
// ─────────────────────────────────────────────────────────────────────────

const FLYER_STORAGE_KEY = 'prs-event-flyer-form'
const FLYER_SCHEMA_VERSION = 1

export function loadSavedFlyerForm(): Partial<FlyerForm> | null {
  return loadVersioned<FlyerForm>(FLYER_STORAGE_KEY, FLYER_SCHEMA_VERSION, 'form')
}

export function saveFlyerForm(form: FlyerForm): void {
  saveVersioned(FLYER_STORAGE_KEY, FLYER_SCHEMA_VERSION, 'form', form)
}

export function clearSavedFlyerForm(): void {
  clearVersioned(FLYER_STORAGE_KEY)
}
