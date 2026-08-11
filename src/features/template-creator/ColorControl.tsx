// One color picker for one FlyerColors key. Mirrors ThemePicker's own
// convention (conventions brief §10) of importing its palette data
// straight from config rather than taking it as a prop.
import { prsPalette } from '@/config/prsPalette'

interface ColorControlProps {
  label: string
  value: string
  onChange: (hex: string) => void
}

export function ColorControl({ label, value, onChange }: ColorControlProps) {
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
    </div>
  )
}
