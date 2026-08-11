interface AppHeaderProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onClear: () => void
  onExport: () => void
  exporting: boolean
  /** Defaults to the success-story app's own title, unchanged for App.tsx. */
  title?: string
}

export function AppHeader({ sidebarCollapsed, onToggleSidebar, onClear, onExport, exporting, title = 'PRS Success Story Builder' }: AppHeaderProps) {
  return (
    <header className="app-header">
      <h1>
        {title}
        <span className="app-version">v{__APP_VERSION__}</span>
      </h1>
      <div className="app-header-actions">
        <button className="btn-header-ghost" onClick={onToggleSidebar}>
          {sidebarCollapsed ? '☰ Show Form' : '✕ Hide Form'}
        </button>
        <button className="btn-header-ghost" onClick={onClear}>Clear</button>
        <button className="btn-download" onClick={onExport} disabled={exporting}>
          {exporting ? 'Generating…' : '↓ Download PDF'}
        </button>
      </div>
    </header>
  )
}
