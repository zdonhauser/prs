// The template creator's editor controls. Mirrors FormPanel/FlyerFormPanel's
// markup/styling (form-section, form-label, form-input) so this unlinked
// tool still feels like the rest of the suite.
//
// Reaches into `story-form/DateSelect` and `photos/PhotoCropModal` (the
// latter via CreatorApp, which owns the modal) directly, the same
// deliberate cross-feature exception `story-form/FormPanel` already makes
// for `photos`/`ai-generate` (conventions brief §1) — the plan doc names
// this exact reuse for the template creator.
import { useRef } from 'react'
import type React from 'react'
import { DateSelect } from '@/features/story-form/DateSelect'
import { flyerTemplates } from '@/config/flyerTemplates'
import { flyerPalettes } from '@/config/flyerPalettes'
import {
  groupByMonth,
  FLYER_FIELDS,
  FLYER_FIELD_LABELS,
  resolvePhotoBox,
  paletteMatches,
  DEFAULT_COLORS,
  DEFAULT_WATERMARK,
} from '@/domain/flyerTemplate'
import type { FlyerColors, FlyerField, FlyerTemplate, PhotoBox } from '@/types'
import { ColorControl } from './ColorControl'
import { PalettePicker } from './PalettePicker'

/** A small "Modified" pill a disclosure's `<summary>` shows when its
    contents differ from the template's defaults, so collapsing the eight
    individual color controls (or the photo/watermark sliders) behind a
    closed disclosure can't quietly hide a real customization from an
    author skimming the panel. */
function ModifiedBadge() {
  return <span className="form-disclosure-modified">Modified</span>
}

interface CreatorPanelProps {
  template: FlyerTemplate
  templateId: string
  onNameChange: (name: string) => void
  onMonthChange: (month: string) => void
  onEyebrowChange: (value: string) => void
  onHeadlineLineChange: (index: number, value: string) => void
  onHeadlineLineAdd: () => void
  onHeadlineLineRemove: (index: number) => void
  onSubtitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onColorChange: (key: keyof FlyerColors, hex: string) => void
  onWatermarkChange: (patch: Partial<FlyerTemplate['watermark']>) => void
  onFieldToggle: (field: FlyerField) => void
  onPhotoFile: (file: File) => void
  onPhotoAdjust: () => void
  onPhotoRemove: () => void
  photoError: string | null
  onImportFile: (file: File) => void
  importError: string | null
  onLoadBundled: (id: string) => void
  onPhotoBoxChange: (patch: Partial<PhotoBox>) => void
  onPhotoBoxReset: () => void
  onPaletteSelect: (colors: FlyerColors) => void
  /** Session-only colors picked via any ColorControl's double-click-a-swatch
      flow, shared by all eight controls (see ColorControl and CreatorApp). */
  customColors: string[]
  onCustomColorAdd: (hex: string) => void
}

const COLOR_FIELDS: Array<{ key: keyof FlyerColors; label: string }> = [
  { key: 'heroBg', label: 'Hero Background — the curved band behind the eyebrow and headline' },
  { key: 'heroPattern', label: 'Watermark Tint — the translucent PRS mark on the hero' },
  { key: 'accent', label: 'Eyebrow, Headline & Icon Glyphs' },
  { key: 'ring', label: 'Photo Ring & Ornament — the ring around the photo and the rule/dot below the subtitle' },
  { key: 'subtitle', label: 'Subtitle Text' },
  { key: 'iconCircle', label: 'Detail Icon Circles — the filled disc behind each DATE/TIME/etc. icon' },
  { key: 'bodyText', label: 'Body Text — the description and the DATE/TIME/etc. labels' },
  { key: 'footerBg', label: 'Footer Background' },
]

export function CreatorPanel({
  template,
  templateId,
  onNameChange,
  onMonthChange,
  onEyebrowChange,
  onHeadlineLineChange,
  onHeadlineLineAdd,
  onHeadlineLineRemove,
  onSubtitleChange,
  onDescriptionChange,
  onColorChange,
  onWatermarkChange,
  onFieldToggle,
  onPhotoFile,
  onPhotoAdjust,
  onPhotoRemove,
  photoError,
  onImportFile,
  importError,
  onLoadBundled,
  onPhotoBoxChange,
  onPhotoBoxReset,
  onPaletteSelect,
  customColors,
  onCustomColorAdd,
}: CreatorPanelProps) {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const monthGroups = groupByMonth(flyerTemplates)
  const photoBox = resolvePhotoBox(template)
  const hasCustomPhotoBox = template.photo.box !== undefined

  // "Modified" for the Advanced color options disclosure means the eight
  // colors have drifted from BOTH every coordinated palette AND the
  // template's own starting colors — checked against both, not just
  // palettes, because makeDefaultTemplate's colors predate the palette
  // picker and don't equal any single palette's own values, which would
  // otherwise mark every fresh template "Modified" before its author has
  // touched a thing.
  const colorsModified =
    !flyerPalettes.some(palette => paletteMatches(template.colors, palette.colors)) &&
    !paletteMatches(template.colors, DEFAULT_COLORS)

  const watermarkModified =
    template.watermark.opacity !== DEFAULT_WATERMARK.opacity ||
    template.watermark.scale !== DEFAULT_WATERMARK.scale ||
    template.watermark.x !== DEFAULT_WATERMARK.x ||
    template.watermark.y !== DEFAULT_WATERMARK.y

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onPhotoFile(file)
  }

  const handleImportInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) onImportFile(file)
  }

  return (
    <div className="form-panel">
      <section className="form-section">
        <h2>Start From</h2>
        <label className="form-label">
          Load a bundled template
          <select
            className="form-input"
            value=""
            onChange={e => {
              if (e.target.value) onLoadBundled(e.target.value)
            }}
          >
            <option value="">Choose a bundled template…</option>
            {monthGroups.map(group => (
              <optgroup key={group.month} label={group.label}>
                {group.templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button type="button" className="btn-upload" onClick={() => importInputRef.current?.click()}>
          Import a Template File…
        </button>
        <input ref={importInputRef} type="file" accept=".json,application/json" hidden onChange={handleImportInput} />
        {importError && <p className="form-error-note">{importError}</p>}
      </section>

      <section className="form-section">
        <h2>Template Info</h2>
        <label className="form-label">
          Template Name
          <input
            type="text"
            className="form-input"
            value={template.name}
            onChange={e => onNameChange(e.target.value)}
            placeholder="e.g. Winter Safety Fair"
          />
        </label>
        <p className="form-id-hint">
          Template ID: <code>{templateId}</code> — how the builder identifies this template
          once it's added to the site; re-exporting under the same name keeps this the same.
          The downloaded file is named from the template name and month instead.
        </p>
        <label className="form-label">
          Month
          <DateSelect value={template.month} onChange={onMonthChange} />
        </label>
      </section>

      <section className="form-section">
        <h2>Text</h2>
        <label className="form-label">
          Eyebrow
          <input
            type="text"
            className="form-input"
            value={template.eyebrow}
            onChange={e => onEyebrowChange(e.target.value)}
            placeholder="e.g. A PRS SIGNATURE EVENT"
          />
        </label>

        <div className="form-label">
          Headline
          {template.headline.map((line, i) => (
            <div key={i} className="headline-line-row">
              <input
                type="text"
                className="form-input"
                value={line}
                onChange={e => onHeadlineLineChange(i, e.target.value)}
                placeholder={`Line ${i + 1}`}
              />
              <button
                type="button"
                className="btn-ghost headline-line-remove"
                onClick={() => onHeadlineLineRemove(i)}
                disabled={template.headline.length <= 1}
                aria-label={`Remove line ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn-ghost headline-line-add" onClick={onHeadlineLineAdd}>
            + Add Line
          </button>
        </div>

        <label className="form-label">
          Subtitle
          <input
            type="text"
            className="form-input"
            value={template.subtitle}
            onChange={e => onSubtitleChange(e.target.value)}
            placeholder="e.g. Working Together for a Safer Tomorrow."
          />
        </label>

        <label className="form-label">
          Description
          <textarea
            className="form-textarea"
            value={template.description}
            onChange={e => onDescriptionChange(e.target.value)}
            rows={4}
            placeholder="A sentence or two describing the event."
          />
        </label>
      </section>

      <section className="form-section">
        <h2>Photo</h2>
        {template.photo.src ? (
          <div className="creator-photo-preview">
            <img src={template.photo.src} alt="" className="creator-photo-thumb" />
            <div className="creator-photo-actions">
              <button type="button" className="btn-ghost" onClick={onPhotoAdjust}>
                Adjust
              </button>
              <button type="button" className="btn-ghost" onClick={() => photoInputRef.current?.click()}>
                Replace…
              </button>
              <button type="button" className="btn-ghost thumb-remove" onClick={onPhotoRemove}>
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn-upload" onClick={() => photoInputRef.current?.click()}>
            + Add Photo
          </button>
        )}
        {/* See PhotoSection's own comment on why this omits the "image/*"
            MIME wildcard — Safari/Chrome's native picker filters out
            HEIC/HEIF whenever any image/… MIME type is present. */}
        <input
          ref={photoInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.avif,.heic,.heif,.tif,.tiff"
          hidden
          onChange={handlePhotoInput}
        />
        {photoError && <p className="form-error-note">{photoError}</p>}
      </section>

      <section className="form-section">
        <details className="form-disclosure">
          <summary>
            Photo Shape &amp; Position
            {hasCustomPhotoBox && <ModifiedBadge />}
          </summary>
          <div className="form-disclosure-content">
            <p className="form-empty-note">Move, resize, or reshape the photo bubble. The teal ring always follows it.</p>
            <div className="text-size-row">
              <span>Left</span>
              <input
                type="range"
                min="-200" max="700" step="1"
                value={photoBox.left}
                onChange={e => onPhotoBoxChange({ left: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{Math.round(photoBox.left)}px</span>
            </div>
            <div className="text-size-row">
              <span>Top</span>
              <input
                type="range"
                min="-250" max="600" step="1"
                value={photoBox.top}
                onChange={e => onPhotoBoxChange({ top: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{Math.round(photoBox.top)}px</span>
            </div>
            <div className="text-size-row">
              <span>Width</span>
              <input
                type="range"
                min="200" max="700" step="1"
                value={photoBox.width}
                onChange={e => onPhotoBoxChange({ width: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{Math.round(photoBox.width)}px</span>
            </div>
            <div className="text-size-row">
              <span>Height</span>
              <input
                type="range"
                min="200" max="700" step="1"
                value={photoBox.height}
                onChange={e => onPhotoBoxChange({ height: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{Math.round(photoBox.height)}px</span>
            </div>
            <button type="button" className="btn-ghost" onClick={onPhotoBoxReset} disabled={!hasCustomPhotoBox}>
              Reset to default
            </button>
          </div>
        </details>
      </section>

      <section className="form-section">
        <h2>Colors</h2>
        <PalettePicker colors={template.colors} onSelect={onPaletteSelect} />
        <details className="form-disclosure">
          <summary>
            Advanced color options
            {colorsModified && <ModifiedBadge />}
          </summary>
          <div className="form-disclosure-content">
            {COLOR_FIELDS.map(({ key, label }) => (
              <ColorControl
                key={key}
                label={label}
                value={template.colors[key]}
                onChange={hex => onColorChange(key, hex)}
                customColors={customColors}
                onCustomColorAdd={onCustomColorAdd}
              />
            ))}
          </div>
        </details>
      </section>

      <section className="form-section">
        <details className="form-disclosure">
          <summary>
            Watermark
            {watermarkModified && <ModifiedBadge />}
          </summary>
          <div className="form-disclosure-content">
            <div className="text-size-row">
              <span>Opacity</span>
              <input
                type="range"
                min="0" max="1" step="0.05"
                value={template.watermark.opacity}
                onChange={e => onWatermarkChange({ opacity: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{Math.round(template.watermark.opacity * 100)}%</span>
            </div>
            <div className="text-size-row">
              <span>Scale</span>
              <input
                type="range"
                min="0.25" max="2" step="0.05"
                value={template.watermark.scale}
                onChange={e => onWatermarkChange({ scale: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{template.watermark.scale.toFixed(2)}×</span>
            </div>
            <div className="text-size-row">
              <span>X</span>
              <input
                type="range"
                min="-300" max="300" step="1"
                value={template.watermark.x}
                onChange={e => onWatermarkChange({ x: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{template.watermark.x}px</span>
            </div>
            <div className="text-size-row">
              <span>Y</span>
              <input
                type="range"
                min="-300" max="300" step="1"
                value={template.watermark.y}
                onChange={e => onWatermarkChange({ y: parseFloat(e.target.value) })}
              />
              <span className="text-size-val">{template.watermark.y}px</span>
            </div>
          </div>
        </details>
      </section>

      <section className="form-section">
        <h2>Editable Fields</h2>
        <p className="form-empty-note">Which detail rows coordinators may fill in for this template.</p>
        {FLYER_FIELDS.map(field => (
          <label key={field} className="field-checkbox-row">
            <input
              type="checkbox"
              checked={template.editableFields.includes(field)}
              onChange={() => onFieldToggle(field)}
            />
            {FLYER_FIELD_LABELS[field]}
          </label>
        ))}
      </section>
    </div>
  )
}
