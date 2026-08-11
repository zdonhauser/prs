import React, { useState, useRef } from 'react'
import { AppHeader } from './AppHeader'
import { useFlyerForm } from './useFlyerForm'
import { usePreviewScale } from './usePreviewScale'
import { FlyerFormPanel } from '@/features/flyer-form/FlyerFormPanel'
import { FlyerCanvas } from '@/features/flyer-preview/FlyerCanvas'
import { exportFlyerPdf } from '@/features/export/exportFlyerPdf'
import { templateById } from '@/config/flyerTemplates'
import { PAGE_W, PAGE_H } from '@/config/page'

export default function FlyerApp() {
  const { form, setTemplateId, updateValue, reset } = useFlyerForm()
  const template = templateById(form.templateId)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const previewAreaRef = useRef<HTMLDivElement>(null)
  const scalerRef = useRef<HTMLDivElement>(null)
  // FlyerCanvas (features/flyer-preview) is out of bounds for this task —
  // it isn't a forwardRef component, so its root `.flyer` element is
  // grabbed via querySelector on this wrapping div rather than a ref
  // forwarded through the component itself.
  const previewWrapperRef = useRef<HTMLDivElement>(null)
  const scale = usePreviewScale(previewAreaRef, sidebarCollapsed)

  const clearForm = () => {
    if (!window.confirm('Clear everything and start a new flyer?')) return
    reset()
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleExport = async () => {
    if (!template) return
    setExporting(true)
    // Remove CSS scale transform so html2canvas captures at native 816x1056
    if (scalerRef.current) scalerRef.current.style.transform = 'none'
    await new Promise(r => setTimeout(r, 80))
    try {
      const flyerElement = previewWrapperRef.current?.querySelector<HTMLElement>('.flyer') ?? null
      await exportFlyerPdf(flyerElement, { template })
      showToast('PDF ready!')
    } catch (err) {
      console.error(err)
      showToast('Export failed — please try again.')
    }
    if (scalerRef.current) scalerRef.current.style.transform = `scale(${scale})`
    setExporting(false)
  }

  return (
    <div className="app">
      <AppHeader
        title="PRS Event Flyer Builder"
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        onClear={clearForm}
        onExport={handleExport}
        exporting={exporting}
      />

      <div className={`app-body ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {!sidebarCollapsed && (
          <FlyerFormPanel
            template={template}
            templateId={form.templateId}
            values={form.values}
            onTemplateChange={setTemplateId}
            onValueChange={updateValue}
          />
        )}

        <div className="preview-area" ref={previewAreaRef}>
          <div className="preview-label">Preview</div>
          {template ? (
            <div className="preview-scaler" style={{ width: PAGE_W * scale, height: PAGE_H * scale }}>
              <div ref={scalerRef} style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H }}>
                <div ref={previewWrapperRef} style={{ boxShadow: '0 6px 32px rgba(0,0,0,0.3)' }}>
                  <FlyerCanvas template={template} values={form.values} />
                </div>
              </div>
            </div>
          ) : (
            // flyerTemplates ships at least one bundled sample; this only
            // shows if that ever changes (e.g. a future build strips it).
            <p style={{ font: '15px "Helvetica Neue", Arial, sans-serif', color: '#2d3748' }}>No flyer templates bundled.</p>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
