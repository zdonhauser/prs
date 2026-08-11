import React from 'react'
import ReactDOM from 'react-dom/client'
import FlyerApp from '@/app/FlyerApp'
// Shared app chrome (header, form panel, preview area, responsive
// breakpoints, toast) — the same stylesheets successStory.tsx pulls in via
// index.css, minus page.css/themes.css, which style the *story's* printed
// page and have nothing in the flyer's DOM to match against. flyer.css is
// the printed flyer itself (out of bounds for this task, imported as-is).
import '../styles/base.css'
import '../styles/form.css'
import '../styles/preview.css'
import '../styles/modals.css'
import '../styles/responsive.css'
import '../styles/flyer.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <FlyerApp />
  </React.StrictMode>
)
