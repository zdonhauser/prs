import React, { useRef } from 'react'
import ReactDOM from 'react-dom/client'
import { FlyerCanvas } from '@/features/flyer-preview/FlyerCanvas'
import { defaultTemplateId, templateById } from '@/config/flyerTemplates'
import { emptyValues } from '@/domain/flyerTemplate'
import { usePreviewScale } from '@/app/usePreviewScale'
import { PAGE_W, PAGE_H } from '@/config/page'
import '../styles/base.css'
import '../styles/flyer.css'

// Preview-only page for Phase 2: renders the default bundled template with
// every coordinator field blank, scaled to fit the viewport. No form, no
// controls, no persistence — the real coordinator app (form + template
// picker + export) is the next phase and will replace this entry's
// contents, the same way App.tsx composes useStoryForm/FormPanel/
// PreviewCanvas for the story builder today.
function EventFlyerPreviewPage() {
  const areaRef = useRef<HTMLDivElement>(null)
  const scale = usePreviewScale(areaRef, false)

  const template = templateById(defaultTemplateId())

  return (
    <div
      ref={areaRef}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
        background: '#f0f4f8',
      }}
    >
      {template ? (
        <div style={{ width: PAGE_W * scale, height: PAGE_H * scale, flexShrink: 0 }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: PAGE_W, height: PAGE_H, boxShadow: '0 6px 32px rgba(0,0,0,0.3)' }}>
            <FlyerCanvas template={template} values={emptyValues()} />
          </div>
        </div>
      ) : (
        // flyerTemplates ships at least one bundled sample; this only
        // shows if that ever changes (e.g. a future build strips it).
        <p style={{ font: '15px "Helvetica Neue", Arial, sans-serif', color: '#2d3748' }}>No flyer templates bundled.</p>
      )}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EventFlyerPreviewPage />
  </React.StrictMode>
)
