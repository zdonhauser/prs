// Renders an input for each of the selected template's editableFields, in
// a fixed field order — matches FormPanel's markup/styling (form-section,
// form-label, form-input) so the two builders feel like one suite.
import { isFieldEditable, FLYER_FIELDS, FLYER_FIELD_LABELS } from '@/domain/flyerTemplate'
import { TemplatePicker } from './TemplatePicker'
import type { FlyerField, FlyerTemplate } from '@/types'

interface FlyerFormPanelProps {
  template: FlyerTemplate | undefined
  templateId: string
  values: Record<FlyerField, string>
  onTemplateChange: (id: string) => void
  onValueChange: (field: FlyerField, value: string) => void
}

const FIELD_PLACEHOLDERS: Record<FlyerField, string> = {
  date: 'e.g. Saturday, September 12',
  time: 'e.g. 10:00 AM – 1:00 PM',
  location: 'e.g. Central Park Community Center',
  additionalInfo: 'Anything else attendees should know',
  rscEmail: 'coordinator@example.com',
}

export function FlyerFormPanel({ template, templateId, values, onTemplateChange, onValueChange }: FlyerFormPanelProps) {
  const fields = template ? FLYER_FIELDS.filter(field => isFieldEditable(template, field)) : []

  return (
    <div className="form-panel">
      <section className="form-section">
        <h2>Template</h2>
        <TemplatePicker value={templateId} onChange={onTemplateChange} />
      </section>

      <section className="form-section">
        <h2>Flyer Details</h2>
        {fields.length === 0 ? (
          <p className="form-empty-note">This template has no editable fields.</p>
        ) : (
          fields.map(field => (
            <label key={field} className="form-label">
              {FLYER_FIELD_LABELS[field]}
              <input
                type={field === 'rscEmail' ? 'email' : 'text'}
                className="form-input"
                value={values[field]}
                onChange={e => onValueChange(field, e.target.value)}
                placeholder={FIELD_PLACEHOLDERS[field]}
              />
            </label>
          ))
        )}
      </section>
    </div>
  )
}
