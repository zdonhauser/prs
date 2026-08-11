import React from 'react'
import ReactDOM from 'react-dom/client'
import CreatorApp from '@/app/CreatorApp'
// Same app-chrome stylesheets eventFlyer.tsx pulls in (this page reuses
// FlyerCanvas for its live preview, plus PhotoCropModal, form inputs, and
// the toast/header chrome those stylesheets style) — not page.css/
// themes.css, which style the story app's printed page and have nothing
// in this page's DOM to match against.
import '../styles/base.css'
import '../styles/form.css'
import '../styles/preview.css'
import '../styles/modals.css'
import '../styles/responsive.css'
import '../styles/flyer.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CreatorApp />
  </React.StrictMode>
)
