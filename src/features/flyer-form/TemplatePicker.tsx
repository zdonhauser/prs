// Lists bundled flyer templates grouped by intended month. Mirrors
// ThemePicker's grid-of-cards idiom (story-form/ThemePicker) — including
// importing its own data straight from config rather than taking it as a
// prop — so the two tools' controls feel like one suite, but under its own
// class names since a template card and a theme swatch are different things.
import { flyerTemplates } from '@/config/flyerTemplates'
import { groupByMonth } from '@/domain/flyerTemplate'

interface TemplatePickerProps {
  value: string
  onChange: (id: string) => void
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  const groups = groupByMonth(flyerTemplates)

  return (
    <div className="template-picker">
      {groups.map(group => (
        <div key={group.month} className="template-picker-group">
          {/* group.label already comes from formatMonth via groupByMonth */}
          <div className="template-picker-month">{group.label}</div>
          <div className="template-grid">
            {group.templates.map(template => (
              <button
                key={template.id}
                type="button"
                className={`template-btn ${value === template.id ? 'active' : ''}`}
                onClick={() => onChange(template.id)}
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
