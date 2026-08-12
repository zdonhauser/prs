import { useState, useRef } from 'react'
import type { CropResult, FlyerColors, FlyerField, FlyerTemplate, PhotoBox } from '@/types'
import { AppHeader } from './AppHeader'
import { usePreviewScale } from './usePreviewScale'
import { CreatorPanel } from '@/features/template-creator/CreatorPanel'
// PhotoCropModal (photos) reused directly here, the same deliberate
// cross-feature exception CreatorPanel's own header comment names for
// DateSelect — this composition root is where that reuse is wired in,
// mirroring how App.tsx wires PhotoCropModal in for the story app.
import { PhotoCropModal } from '@/features/photos/PhotoCropModal'
import { FlyerCanvas } from '@/features/flyer-preview/FlyerCanvas'
import { makeDefaultTemplate, validateTemplate, slugify, emptyValues, exampleValues, withExampleText, formatMonth, FLYER_FIELDS, resolvePhotoBox } from '@/domain/flyerTemplate'
import { templateById } from '@/config/flyerTemplates'
import { deliverFile } from '@/features/export/shared'
import { PAGE_W, PAGE_H } from '@/config/page'
import { readFileAsPendingPhoto, bakeCroppedPhoto, cropCellSize, loadImageElement, type PendingPhoto } from '@/features/template-creator/photoPipeline'

// Coordinators never see a template's own preview with any of their entered
// values in it — this creator's live preview shows the template exactly as
// a coordinator would before typing anything, i.e. the labels/icons only.
// Two ways to look at a template being designed: with realistic stand-in
// details, which is what an author needs to judge spacing, and empty, which
// is how a coordinator first sees it. Examples by default — the blank state
// is the one you can already picture.
const EXAMPLE_PREVIEW_VALUES = exampleValues()
const EMPTY_PREVIEW_VALUES = emptyValues()

// The webmaster who adds exported templates to the site.
const WEBMASTER_EMAIL = 'zac@donrey.dev'

// Pre-writes the handoff email. A page cannot attach a file to a mailto — the
// spec has no attachment parameter and every mail client ignores attempts —
// so the body tells the author to attach it themselves rather than pretending
// it's already there.
//
// This is the ONLY handoff path — there used to also be a direct link to
// GitHub's upload UI (deep-linked to the templates folder, whose commit step
// offers "Create a new branch for this commit and start a pull request", so
// an author with repo access could go from exported file to open PR without
// touching git). It was tried and pulled: too complicated for this
// audience, alongside the email option, to present as a real choice.
// Automating it further than that isn't simple either — GitHub's
// prefilled-new-file URL (/new/BRANCH?filename=&value=) would need the
// template's contents in the query string: ours is 64,652 characters,
// ~67,000 urlencoded, against a practical URL ceiling near 8,000 — the
// embedded photo alone blows it out. Opening a PR directly from the page
// instead would need either a GitHub token living in the browser or a
// backend to hold one, and this app has deliberately had neither. Revisit
// if a simpler upload option comes up, but don't just re-add the link.
// Matches the naming convention the two PDF exporters already use
// (exportPdf.ts's `Success_Story_${slug}_${dateStr}.pdf`, exportFlyerPdf.ts's
// `Event_Flyer_${slug}_${template.month}.pdf`) rather than the template's own
// `id` (which is what the file was named before) — a human-facing label, not
// a lookup key. The loader (config/flyerTemplates.ts) globs every `*.json`
// under flyerTemplates/ and identifies each one by the `id` field it reads
// out of the file's own contents, never by filename, so the download name
// carries no meaning to the app: re-exporting an unchanged template still
// produces this same filename, and it still replaces cleanly on upload.
function templateFileName(template: FlyerTemplate): string {
  const slug = template.name.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_')
  return `Flyer_Template_${slug}_${template.month}.json`
}

function mailtoHref(fileName: string, template: FlyerTemplate): string {
  const subject = `New PRS event flyer template: ${template.name}`
  const body = [
    `Hi,`,
    ``,
    `Please add this flyer template to the Event Flyer Builder.`,
    ``,
    `Template: ${template.name}`,
    `Month: ${formatMonth(template.month)}`,
    `File: ${fileName} (attached)`,
    ``,
    `It goes in src/config/flyerTemplates/ in the prs repository — the README's`,
    `"adding a flyer template" section has the steps.`,
    ``,
    `Thanks!`,
  ].join('\n')
  return `mailto:${WEBMASTER_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

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
  // The uncropped original + the crop baked from it, so the author can
  // reopen and readjust without losing what's outside the current crop.
  const [photoSource, setPhotoSource] = useState<{ photo: PendingPhoto; crop: CropResult } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [exportedFile, setExportedFile] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Custom colors picked via a ColorControl's double-click-a-swatch flow
  // (see ColorControl), shared by all eight controls so a color dialed in
  // for one key can be reused on another. Session-only by design: not
  // part of FlyerTemplate, so never persisted or exported.
  const [customColors, setCustomColors] = useState<string[]>([])
  const previewAreaRef = useRef<HTMLDivElement>(null)

  const scale = usePreviewScale(previewAreaRef, sidebarCollapsed)

  // What the PREVIEW renders. `template` itself is never touched, so nothing
  // here can reach an export — the stand-ins exist so a half-finished
  // template still shows a designed-looking page.
  const previewTemplate = showExamples ? withExampleText(template) : template

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

  // One click applies all eight FlyerColors keys at once — the palette
  // picker's whole point (see flyerPalettes.ts). A fresh copy of the
  // palette's colors object, not the palette's own object, so per-color
  // deviations afterward (via updateColor) never mutate config data.
  const applyPalette = (colors: FlyerColors) => {
    setTemplate(prev => ({ ...prev, colors: { ...colors } }))
  }

  // Lifted here (rather than local to one ColorControl) because the brief
  // asks for one shared row every one of the eight controls can reuse a
  // color from. Deduped case-insensitively so double-clicking the same
  // swatch twice, or picking a color two controls already agree on,
  // doesn't grow the row pointlessly.
  const addCustomColor = (hex: string) => {
    setCustomColors(prev => (prev.some(c => c.toLowerCase() === hex.toLowerCase()) ? prev : [...prev, hex]))
  }

  const updateWatermark = (patch: Partial<FlyerTemplate['watermark']>) => {
    setTemplate(prev => ({ ...prev, watermark: { ...prev.watermark, ...patch } }))
  }

  // Patches the effective box (the template's own, or DEFAULT_PHOTO_BOX if
  // it hasn't set one yet) rather than a possibly-partial stored one, so
  // dragging one slider (say, just `left`) always starts from a complete,
  // resolved box instead of merging onto `undefined`.
  const updatePhotoBox = (patch: Partial<PhotoBox>) => {
    setTemplate(prev => ({ ...prev, photo: { ...prev.photo, box: { ...resolvePhotoBox(prev), ...patch } } }))
  }

  // Removes the key entirely (not `box: undefined`) so the template goes
  // back to validating and rendering exactly like one that never had a box
  // — the same state every already-committed template is in.
  const resetPhotoBox = () => {
    setTemplate(prev => {
      const photo = { ...prev.photo }
      delete photo.box
      return { ...prev, photo }
    })
  }

  const toggleField = (field: FlyerField) => {
    setTemplate(prev => {
      const has = prev.editableFields.includes(field)
      const next = has ? prev.editableFields.filter(f => f !== field) : [...prev.editableFields, field]
      // Re-filtered through the domain's fixed field order rather than just
      // appended, so the schema's `editableFields` array (and the exported
      // JSON) always lists fields in the same order regardless of which
      // checkbox was clicked when.
      return { ...prev, editableFields: FLYER_FIELDS.filter(f => next.includes(f)) }
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
      const cell = cropCellSize(pendingPhoto, resolvePhotoBox(template))
      const src = await bakeCroppedPhoto(pendingPhoto, crop, cell)
      // Spread prev.photo, not a fresh { src } — the box the author dialed
      // in via the shape sliders lives on this same object, and a bare
      // { src } would silently drop it back to DEFAULT_PHOTO_BOX on every
      // crop save (including "Replace…", which goes through this same
      // handler).
      setTemplate(prev => ({ ...prev, photo: { ...prev.photo, src } }))
      // Keep the uncropped original and the crop that produced this bake, so
      // "Adjust" can reopen exactly where the author left off instead of
      // re-cropping an already-cropped image. The template itself only ever
      // carries the flat baked src (schema has no zoom/pan), so this lives
      // in component state and is deliberately not exported.
      setPhotoSource({ photo: pendingPhoto, crop })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't process this photo.")
    }
    setPendingPhoto(null)
  }

  // Reopens the crop modal. Normally that means the original file at the
  // author's last zoom/pan. After loading a bundled or imported template
  // there is no original — only the baked square — so that is reopened
  // instead: re-framing and zooming further in still work, only zooming back
  // out past the existing crop doesn't.
  const handlePhotoAdjust = async () => {
    setPhotoError(null)
    if (photoSource) {
      setPendingPhoto({ ...photoSource.photo, ...photoSource.crop })
      return
    }
    if (!template.photo.src) return
    try {
      const img = await loadImageElement(template.photo.src)
      setPendingPhoto({
        id: 'creator-photo',
        src: template.photo.src,
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        zoom: 1,
        panX: 0,
        panY: 0,
      })
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't reopen this photo.")
    }
  }

  const handlePhotoRemove = () => {
    // Keeps prev.photo.box (if any) for the same reason handleCropSave does
    // — removing the photo is not the same action as resetting its shape,
    // and an author who already dialed in a custom bubble shouldn't lose it
    // just because they're swapping the picture out.
    setTemplate(prev => ({ ...prev, photo: { ...prev.photo, src: '' } }))
    setPhotoSource(null)
  }

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const validated = validateTemplate(parsed)
      setTemplate(validated)
      setPhotoSource(null)
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
    setPhotoSource(null)
    setLoaded({ name: found.name, id: found.id })
    setImportError(null)
  }

  const handleNewTemplate = () => {
    if (!window.confirm('Start a new template? Unsaved changes will be lost.')) return
    setTemplate(makeDefaultTemplate())
    setPhotoSource(null)
    setLoaded(null)
    setImportError(null)
    setPhotoError(null)
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const validated = validateTemplate(template)
      const fileName = templateFileName(validated)
      const blob = new Blob([JSON.stringify(validated, null, 2)], { type: 'application/json' })
      await deliverFile(blob, fileName)
      // Not a toast: a template is only half-delivered when the file lands in
      // Downloads, and the rest of the job (getting it into the repo) is the
      // part an author has no way to guess. This stays on screen until
      // dismissed, and names the actual file.
      setExportedFile(fileName)
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
            onPhotoAdjust={handlePhotoAdjust}
            onPhotoRemove={handlePhotoRemove}
            photoError={photoError}
            onImportFile={handleImportFile}
            importError={importError}
            onLoadBundled={handleLoadBundled}
            onPhotoBoxChange={updatePhotoBox}
            onPhotoBoxReset={resetPhotoBox}
            onPaletteSelect={applyPalette}
            customColors={customColors}
            onCustomColorAdd={addCustomColor}
          />
        )}

        <div className="preview-area" ref={previewAreaRef}>
          <div className="preview-label">
            Preview
            <label className="preview-toggle">
              <input
                type="checkbox"
                checked={showExamples}
                onChange={e => setShowExamples(e.target.checked)}
              />
              Show example details
            </label>
          </div>
          <div className="preview-scaler" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
              <div style={{ boxShadow: '0 6px 32px rgba(0,0,0,0.3)' }}>
                <FlyerCanvas
                  template={previewTemplate}
                  values={showExamples ? EXAMPLE_PREVIEW_VALUES : EMPTY_PREVIEW_VALUES}
                  onPhotoClick={template.photo.src ? handlePhotoAdjust : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingPhoto && (
        <PhotoCropModal
          photo={pendingPhoto}
          cellW={cropCellSize(pendingPhoto, resolvePhotoBox(template)).w}
          cellH={cropCellSize(pendingPhoto, resolvePhotoBox(template)).h}
          shape="circle"
          onSave={handleCropSave}
          onCancel={() => setPendingPhoto(null)}
        />
      )}

      {exportedFile && (
        <div className="export-done-overlay" onClick={() => setExportedFile(null)}>
          <div className="export-done" onClick={e => e.stopPropagation()}>
            <h3>Template saved</h3>
            <p className="export-done-file">{exportedFile}</p>
            <p>
              Coordinators won't see this template until it's added to the site — send this file
              to the webmaster to finish.
            </p>

            <a className="btn-primary-sm export-done-mail" href={mailtoHref(exportedFile, template)}>
              Email the webmaster
            </a>
            <p className="export-done-note">
              Opens your mail app with the message written. <strong>Attach{' '}
              <code>{exportedFile}</code> before sending</strong> — a web page isn't allowed to
              attach files for you. On an iPad it's wherever you saved it, usually Files
              &rsaquo; Downloads.
            </p>

            <p className="export-done-note">
              It appears in the builder under {formatMonth(template.month)} once it's live.
            </p>
            <button type="button" className="btn-ghost" onClick={() => setExportedFile(null)}>Close</button>
          </div>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
