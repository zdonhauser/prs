import { useState, useEffect, useCallback, useRef } from 'react'
import { loadSavedFlyerForm, saveFlyerForm, clearSavedFlyerForm } from '@/services/storage'
import { emptyValues } from '@/domain/flyerTemplate'
import { defaultTemplateId, templateById } from '@/config/flyerTemplates'
import type { FlyerForm, FlyerField } from '@/types'

export function makeDefaultFlyerForm(): FlyerForm {
  return { templateId: defaultTemplateId(), values: emptyValues() }
}

export function useFlyerForm(): {
  form: FlyerForm
  setTemplateId: (id: string) => void
  updateValue: (field: FlyerField, value: string) => void
  reset: () => void
} {
  const [form, setForm] = useState<FlyerForm>(() => {
    const saved = loadSavedFlyerForm()
    const merged: FlyerForm = {
      ...makeDefaultFlyerForm(),
      ...saved,
      // Shallow-spreading `saved` alone would leave `values` missing any
      // key a saved payload doesn't have (schema drift, hand-edited
      // storage), turning that field's input uncontrolled — merge one
      // level deeper so every FlyerField always has a string.
      values: { ...emptyValues(), ...saved?.values },
    }
    // A saved templateId whose template is no longer bundled would leave
    // the coordinator on a template that can't render; fall back to the
    // current default the same way a first run would.
    if (!templateById(merged.templateId)) {
      merged.templateId = defaultTemplateId()
    }
    return merged
  })

  // Switching templates keeps values for fields the new template also
  // exposes and drops the rest — a value entered for a field the new
  // template doesn't have wouldn't be reachable to edit or clear again.
  const setTemplateId = useCallback((id: string) => {
    setForm(prev => {
      const template = templateById(id)
      const nextValues = emptyValues()
      if (template) {
        for (const field of template.editableFields) {
          nextValues[field] = prev.values[field]
        }
      }
      return { templateId: id, values: nextValues }
    })
  }, [])

  const updateValue = useCallback((field: FlyerField, value: string) => {
    setForm(prev => ({ ...prev, values: { ...prev.values, [field]: value } }))
  }, [])

  // Persist everything typed so a trip away and back (or a PWA reload)
  // doesn't wipe the form — mirrors useStoryForm's debounced save, with one
  // difference: the very first run (mount) is skipped. Unlike the story
  // form, this state's `templateId` starts out as whatever
  // `defaultTemplateId()` picked for *today* — persisting that on mount,
  // before the coordinator has touched anything, would write this month's
  // default to storage and have it silently shadow next month's default
  // the next time they open the builder having never made a real choice.
  const isMounted = useRef(false)
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    const timer = setTimeout(() => saveFlyerForm(form), 400)
    return () => clearTimeout(timer)
  }, [form])

  const reset = useCallback(() => {
    clearSavedFlyerForm()
    setForm(makeDefaultFlyerForm())
  }, [])

  return { form, setTemplateId, updateValue, reset }
}
