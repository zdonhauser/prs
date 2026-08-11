import { useState, useRef } from 'react'
import type { CropResult, FlyerColors, FlyerField, FlyerTemplate } from '@/types'
import { AppHeader } from './AppHeader'
import { usePreviewScale } from './usePreviewScale'
import { CreatorPanel } from '@/features/template-creator/CreatorPanel'
// PhotoCropModal (photos) reused directly here, the same deliberate
// cross-feature exception CreatorPanel's own header comment names for
// DateSelect — this composition root is where that reuse is wired in,
// mirroring how App.tsx wires PhotoCropModal in for the story app.
import { PhotoCropModal } from '@/features/photos/PhotoCropModal'
import { FlyerCanvas } from '@/features/flyer-preview/FlyerCanvas'
import { makeDefaultTemplate, validateTemplate, slugify, emptyValues } from '@/domain/flyerTemplate'
import { templateById } from '@/config/flyerTemplates'
import { deliverFile } from '@/features/export/shared'
import { PAGE_W, PAGE_H } from '@/config/page'
import { readFileAsPendingPhoto, bakeCroppedPhoto, cropCellSize, type PendingPhoto } from '@/features/template-creator/photoPipeline'

// Coordinators never see a template's own preview with any of their entered
// values in it — this creator's live preview shows the template exactly as
// a coordinator would before typing anything, i.e. the labels/icons only.
const PREVIEW_VALUES = emptyValues()

// Toggled fields are re-filtered through this fixed order rather than just
// appended, so the schema's `editableFields` array (and the exported JSON)
// always lists fields in the same order regardless of which checkbox was
// clicked when.
const FIELD_ORDER: FlyerField[] = ['date', 'time', 'location', 'additionalInfo', 'rscEmail']

export default function CreatorApp() {
  const [template, setTemplate] = useState<FlyerTemplate>(() => makeDefaultTemplate())
  // The name a loaded template arrived under, or null for a fresh one. The
  // id normally follows the name, but a template loaded from the bundled set
  // or an imported file keeps its committed id for as long as its name is
  // unchanged, so re-exporting after fixing a typo elsewhere updates that
  // same file rather than forking a near-duplicate.
  //
  // Renaming releases it. The manager's workflow is to prepare months ahead
  // by opening last month's template and adapting it — if the id stayed
  // pinned through a rename, the export would be written back under the
  // ORIGINAL filename and silently overwrite the template it started from
  // when uploaded. A rename is the clearest signal that this is a new
  // template, so the id re-derives from the new name.
  const [loaded, setLoaded] = useState<{ name: string; id: string } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [pendingPhoto, setPendingPhoto] = useState<PendingPhoto | null>(null)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const scalerRef = useRef<HTMLDivElement>(null)

  const scale = usePreviewScale(previewAreaRef, sidebarCollapsed)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const updateName = (name: string) => {
    setTemplate(prev => ({
      ...prev,
      name,
      // Back to the loaded name means back to its committed id, even if the
      // name was changed and changed back — restore it rather than keeping
      // whatever the intermediate rename derived.
      id: loaded !== null && name === loaded.name ? loaded.id : slugify(name) || 'untitled',
    }))
  }

  const updateMonth = (month: string) => setTemplate(prev => ({ ...prev, month }))
  const updateEyebrow = (eyebrow: string) => setTemplate(prev => ({ ...prev, eyebrow }))
  const updateSubtitle = (subtitle: string) => setTemplate(prev => ({ ...prev, subtitle }))
  const updateDescription = (description: string) => setTemplate(prev => ({ ...prev, description }))

  const updateHeadlineLine = (index: number, value: string) => {
    setTemplate(prev => ({ ...prev, headline: prev.headline.map((line, i) => (i === index ? value : line)) }))
  }
  const addHeadlineLine = () => setTemplate(prev => ({ ...prev, headline: [...prev.headline, ''] }))
  const removeHeadlineLine = (index: number) => {
    setTemplate(prev => (prev.headline.length <= 1 ? prev : { ...prev, headline: prev.headline.filter((_, i) => i !== index) }))
  }

  const updateColor = (key: keyof FlyerColors, hex: string) => {
    setTemplate(prev => ({ ...prev, colors: { ...prev.colors, [key]: hex } }))
  }

  const updateWatermark = (patch: Partial<FlyerTemplate['watermark']>) => {
    setTemplate(prev => ({ ...prev, watermark: { ...prev.watermark, ...patch } }))
  }

  const toggleField = (field: FlyerField) => {
    setTemplate(prev => {
      const has = prev.editableFields.includes(field)
      const next = has ? prev.editableFields.filter(f => f !== field) : [...prev.editableFields, field]
      return { ...prev, editableFields: FIELD_ORDER.filter(f => next.includes(f)) }
    })
  }

  const handlePhotoFile = async (file: File) => {
    setPhotoError(null)
    try {
      const photo = await readFileAsPendingPhoto(file)
      setPendingPhoto(photo)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : `Couldn't add "${file.name}".`)
    }
  }

  const handleCropSave = async (crop: CropResult) => {
    if (!pendingPhoto) return
    try {
      const size = cropCellSize(pendingPhoto)
      const src = await bakeCroppedPhoto(pendingPhoto, crop, size)
      setTemplate(prev => ({ ...prev, photo: { src } }))
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't process this photo.")
    }
    setPendingPhoto(null)
  }

  const handlePhotoRemove = () => setTemplate(prev => ({ ...prev, photo: { src: '' } }))

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const validated = validateTemplate(parsed)
      setTemplate(validated)
      setLoaded({ name: validated.name, id: validated.id })
      setImportError(null)
      showToast(`Loaded "${validated.name}" for editing.`)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't import this file.")
    }
  }

  const handleLoadBundled = (id: string) => {
    const found = templateById(id)
    if (!found) return
    setTemplate(found)
    setLoaded({ name: found.name, id: found.id })
    setImportError(null)
  }

  const handleNewTemplate = () => {
    if (!window.confirm('Start a new template? Unsaved changes will be lost.')) return
    setTemplate(makeDefaultTemplate())
    setLoaded(null)
    setImportError(null)
    setPhotoError(null)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const validated = validateTemplate(template)
      const blob = new Blob([JSON.stringify(validated, null, 2)], { type: 'application/json' })
      await deliverFile(blob, `${validated.id}.json`)
      showToast('Template exported!')
    } catch (err) {
      showToast(err instanceof Error ? `Can't export: ${err.message}` : "Can't export this template yet.")
    }
    setExporting(false)
  }

  return (
    <div className="app">
      <AppHeader
        title="PRS Template Creator"
        exportLabel="↓ Export Template"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        onClear={handleNewTemplate}
        onExport={handleExport}
        exporting={exporting}
      />

      <div className={`app-body ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <CreatorPanel
            template={template}
            templateId={template.id}
            onNameChange={updateName}
            onMonthChange={updateMonth}
            onEyebrowChange={updateEyebrow}
            onHeadlineLineChange={updateHeadlineLine}
            onHeadlineLineAdd={addHeadlineLine}
            onHeadlineLineRemove={removeHeadlineLine}
            onSubtitleChange={updateSubtitle}
            onDescriptionChange={updateDescription}
            onColorChange={updateColor}
            onWatermarkChange={updateWatermark}
            onFieldToggle={toggleField}
            onPhotoFile={handlePhotoFile}
            onPhotoRemove={handlePhotoRemove}
            photoError={photoError}
            onImportFile={handleImportFile}
            importError={importError}
            onLoadBundled={handleLoadBundled}
          />
        )}

        <div className="preview-area" ref={previewAreaRef}>
          <div className="preview-label">Preview</div>
          <div className="preview-scaler" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div ref={scalerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
              <div style={{ boxShadow: '0 6px 32px rgba(0,0,0,0.3)' }}>
                <FlyerCanvas template={template} values={PREVIEW_VALUES} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingPhoto && (
        <PhotoCropModal
          photo={pendingPhoto}
          cellW={cropCellSize(pendingPhoto)}
          cellH={cropCellSize(pendingPhoto)}
          onSave={handleCropSave}
          onCancel={() => setPendingPhoto(null)}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
