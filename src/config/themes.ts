import logoBlackUrl from '../assets/logo-black.png'
import logoColorUrl from '../assets/logo-color.png'
import logoWhiteUrl from '../assets/logo-white.png'

export const themes = [
  { id: 'classic',    name: 'Classic Blue' },
  { id: 'navy-gold',  name: 'Navy & Gold' },
  { id: 'teal-fresh', name: 'Teal Fresh' },
  { id: 'warm-earth', name: 'Warm Earth' },
  { id: 'bold-red',   name: 'Bold Red' },
  { id: 'forest',     name: 'Forest' },
  { id: 'slate-pro',  name: 'Slate Pro' },
  { id: 'sunrise',    name: 'Sunrise' },
  { id: 'minimal',    name: 'Minimal' },
  { id: 'prs-vibrant',name: 'PRS Vibrant' },
] as const

export type ThemeId = (typeof themes)[number]['id']

// Swatch colors for the theme picker UI (primary, accent)
export const themeSwatch: Record<ThemeId, [string, string]> = {
  'classic':    ['#2056a0', '#e8c96a'],
  'navy-gold':  ['#1a2d4f', '#c9a84c'],
  'teal-fresh': ['#1898c0', '#e8c96a'],
  'warm-earth': ['#8b6850', '#e09040'],
  'bold-red':   ['#e04830', '#2056a0'],
  'forest':     ['#1b4332', '#52b788'],
  'slate-pro':  ['#334155', '#2056a0'],
  'sunrise':    ['#c2410c', '#fbbf24'],
  'minimal':    ['#94a3b8', '#e2e8f0'],
  'prs-vibrant':['#2056a0', '#e04830'],
}

// Logo variant behind each theme's header. Themes with a solid dark
// header band need the white cutout; themes with a plain white header
// area use the color mark, except the flatter/more subdued themes
// (Slate Pro, Minimal) which read cleaner with the black mark.
export const themeLogo: Record<ThemeId, 'color' | 'black' | 'white'> = {
  'classic':     'white',
  'navy-gold':   'white',
  'teal-fresh':  'color',
  'warm-earth':  'color',
  'bold-red':    'color',
  'forest':      'white',
  'slate-pro':   'black',
  'sunrise':     'color',
  'minimal':     'black',
  'prs-vibrant': 'color',
}

// Imported rather than referenced as public/ files by path. The suite serves
// its tools from subdirectories (/success-story/, /event-flyer/), so a
// page-relative './logo-white.png' resolves against the tool's directory and
// 404s. Importing lets vite emit a hashed URL that resolves correctly from
// any page depth, and gets the logos precached with the rest of the bundle.
export const logoSrc: Record<'color' | 'black' | 'white', string> = {
  color: logoColorUrl,
  black: logoBlackUrl,
  white: logoWhiteUrl,
}
