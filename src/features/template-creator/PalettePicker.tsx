// One-click coordinated color schemes for the flyer, at the top of the
// creator's Colors section. Mirrors ThemePicker's own convention
// (conventions brief §10) of importing its data straight from config and
// rendering a swatch grid — the two-color swatch chip is the same idiom
// ThemePicker uses for the story app's theme grid, reusing its
// `.theme-grid`/`.theme-btn`/`.theme-swatch` styling rather than inventing
// a parallel set of classes for what is visually the identical control.
import { flyerPalettes } from '@/config/flyerPalettes'
import { paletteMatches } from '@/domain/flyerTemplate'
import type { FlyerColors } from '@/types'

interface PalettePickerProps {
  colors: FlyerColors
  onSelect: (colors: FlyerColors) => void
}

export function PalettePicker({ colors, onSelect }: PalettePickerProps) {
  return (
    <div className="theme-grid palette-grid">
      {flyerPalettes.map(palette => (
        <button
          key={palette.name}
          type="button"
          className={`theme-btn ${paletteMatches(colors, palette.colors) ? 'active' : ''}`}
          onClick={() => onSelect(palette.colors)}
          title={palette.name}
        >
          <div className="theme-swatch">
            <div style={{ background: palette.colors.heroBg, flex: 1 }} />
            <div style={{ background: palette.colors.accent, width: '30%' }} />
          </div>
          <span>{palette.name}</span>
        </button>
      ))}
    </div>
  )
}
