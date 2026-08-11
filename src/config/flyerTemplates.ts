// Data access for bundled flyer templates. No rendering, no React.
//
// Every JSON file under ./flyerTemplates/ is loaded eagerly via
// import.meta.glob so templates are bundled at build time and precached by
// the service worker. `import.meta.glob`'s typing (vite/types/importGlob.d.ts)
// resolves to `Record<string, unknown>` here since no `as` option is passed
// (the deprecated option the types key off of) — `import: 'default'` still
// unwraps each module's default export at runtime, so `unknown` is exactly
// what validateTemplate expects and no `resolveJsonModule`/`.d.ts` hop is
// needed for this to type-check under `strict`.
import type { FlyerTemplate } from '@/types'
import { validateTemplate, compareMonth, currentMonth } from '@/domain/flyerTemplate'

const templateModules = import.meta.glob('./flyerTemplates/*.json', {
  eager: true,
  import: 'default',
})

function loadTemplate(path: string, raw: unknown): FlyerTemplate {
  try {
    return validateTemplate(raw)
  } catch (error) {
    // A malformed bundled template is a build-time authoring mistake — the
    // TypeError propagates, but wrapped to name the offending file.
    const reason = error instanceof Error ? error.message : String(error)
    throw new TypeError(`Invalid flyer template in ${path}: ${reason}`, { cause: error })
  }
}

export const flyerTemplates: FlyerTemplate[] = Object.entries(templateModules)
  .map(([path, raw]) => loadTemplate(path, raw))
  .sort((a, b) => compareMonth(a.month, b.month) || a.name.localeCompare(b.name))

export function templateById(id: string): FlyerTemplate | undefined {
  return flyerTemplates.find((template) => template.id === id)
}

/**
 * The id of a template whose month equals the current month, if one
 * exists; otherwise the most recent template not in the future; otherwise
 * the first template. `''` if there are no templates at all.
 */
export function defaultTemplateId(now: Date = new Date()): string {
  if (flyerTemplates.length === 0) return ''

  const current = currentMonth(now)
  const exactMatch = flyerTemplates.find((template) => template.month === current)
  if (exactMatch) return exactMatch.id

  // flyerTemplates is sorted by month ascending, so the last entry whose
  // month isn't in the future is the most recent one.
  const notFuture = flyerTemplates.filter((template) => compareMonth(template.month, current) <= 0)
  if (notFuture.length > 0) return notFuture[notFuture.length - 1].id

  return flyerTemplates[0].id
}
