// One color picker for one FlyerColors key. Mirrors ThemePicker's own
// convention (conventions brief §10) of importing its palette data
// straight from config rather than taking it as a prop.
//
// Single click on a swatch still just selects it (the common case, per the
// brief) — double-click is the new path: it seeds a hidden native
// `<input type="color">` with that swatch's own hex and opens it, so the
// author can dial in a variant starting from a known color instead of the
// OS picker's default white. Whatever comes out of that goes both to this
// control (`onChange`, same as any other selection) and into the
// `customColors` row lifted to CreatorApp, shared by all eight controls —
// see CreatorApp's `addCustomColor`.
import { useRef } from 'react'
import type React from 'react'
import { prsPalette } from '@/config/prsPalette'

interface ColorControlProps {
  label: string
  value: string
  onChange: (hex: string) => void
  /** Session-only colors any ColorControl's double-click flow has picked
      so far, shared across all eight — see CreatorApp. */
  customColors: string[]
  onCustomColorAdd: (hex: string) => void
}

export function ColorControl({ label, value, onChange, customColors, onCustomColorAdd }: ColorControlProps) {
  const seedInputRef = useRef<HTMLInputElement>(null)

  // Opens the native picker seeded with `hex` — showPicker() where
  // available (a direct, unambiguous "open now" call), falling back to
  // .click() (relies on the input's own default open-on-click behavior)
  // for browsers that don't implement it yet.
  const openSeededPicker = (hex: string) => {
    const el = seedInputRef.current
    if (!el) return
    el.value = hex
    // showPicker() is broadly supported (Chrome/Edge 99+, Firefox 101+,
    // Safari 16.4+) but still worth guarding at runtime rather than
    // trusting the type lib's optimism — a browser genuinely missing it
    // throws calling it, so .click() (relies on the input's own
    // default open-on-click behavior) is the fallback.
    if (typeof el.showPicker === 'function') {
      el.showPicker()
    } else {
      el.click()
    }
  }

  const handleSeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value
    onChange(hex)
    onCustomColorAdd(hex)
  }

  const renderSwatch = (hex: string) => (
    <button
      key={hex}
      type="button"
      className={`color-swatch ${value.toLowerCase() === hex.toLowerCase() ? 'active' : ''}`}
      style={{ background: hex }}
      title={hex}
      aria-label={hex}
      onClick={() => onChange(hex)}
      onDoubleClick={() => openSeededPicker(hex)}
    />
  )

  return (
    <div className="color-control">
      <div className="color-control-label">{label}</div>
      <div className="color-swatch-row">
        {prsPalette.map(swatch => (
          <button
            key={swatch.hex}
            type="button"
            className={`color-swatch ${value.toLowerCase() === swatch.hex.toLowerCase() ? 'active' : ''}`}
            style={{ background: swatch.hex }}
            title={swatch.name}
            aria-label={swatch.name}
            onClick={() => onChange(swatch.hex)}
            onDoubleClick={() => openSeededPicker(swatch.hex)}
          />
        ))}
        <input
          type="color"
          className="color-custom-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          title="Custom color"
          aria-label={`${label} — custom color`}
        />
      </div>
      {customColors.length > 0 && (
        <div className="color-swatch-row color-swatch-row--custom">
          {customColors.map(hex => renderSwatch(hex))}
        </div>
      )}
      {/* Hidden — never shown itself, only opened programmatically by
          openSeededPicker. A dedicated input per control (not the visible
          "Custom color" one above) so seeding it never flashes that one's
          own swatch to a different color first. */}
      <input ref={seedInputRef} type="color" hidden onChange={handleSeedChange} aria-hidden="true" tabIndex={-1} />
    </div>
  )
}
