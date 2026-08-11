// Coordinated colour schemes for the flyer — the equivalent of the story
// app's themes, and the starting point a template author is meant to use.
// One click sets all eight FlyerColors keys to values chosen to work
// together; the per-colour swatches stay available for deviating afterwards.
//
// Static data only, no logic.
//
// Each scheme derives from a story theme's primary/accent pair so the two
// tools look like one suite. `heroPattern` is its `heroBg` mixed 16% toward
// white, matching the tint measured on the reference flyer's watermark.
//
// Every accent/heroBg pair was contrast-checked, because the headline prints
// in `accent` directly on `heroBg` and a low-contrast pair is unreadable at
// any size. The measured ratios are:
//
//   PRS Classic 4.9:1   Navy & Gold 6.0:1   Teal Fresh 4.5:1
//   Warm Earth  5.1:1   Bold Red    4.5:1   Forest     6.9:1
//   Slate Pro   8.4:1   Sunrise     4.4:1
//
// All clear 4.5:1 (WCAG AA for normal text, and comfortably past the 3:1
// large-text bar the headline actually falls under). Three schemes needed
// tuning to get there — Teal Fresh, Warm Earth and Sunrise all started from
// their story theme's colours at 2.0-3.1:1, so their heroBg was darkened
// and/or their accent lightened. Keep that check in mind when adding one.
import type { FlyerColors } from '@/types'

export const flyerPalettes: ReadonlyArray<{ name: string; colors: FlyerColors }> = [
  { name: 'PRS Classic', colors: { heroBg: '#2259a9', heroPattern: '#4574b7', accent: '#efda87', ring: '#0e97c3', subtitle: '#2259a9', iconCircle: '#2259a9', bodyText: '#262626', footerBg: '#2259a9' } },
  { name: 'Navy & Gold', colors: { heroBg: '#1a2d4f', heroPattern: '#3f4f6b', accent: '#c9a84c', ring: '#c9a84c', subtitle: '#1a2d4f', iconCircle: '#1a2d4f', bodyText: '#262626', footerBg: '#1a2d4f' } },
  { name: 'Teal Fresh', colors: { heroBg: '#0f7391', heroPattern: '#3589a3', accent: '#ffe9a8', ring: '#5ec5e0', subtitle: '#0f7391', iconCircle: '#0f7391', bodyText: '#262626', footerBg: '#0f7391' } },
  { name: 'Warm Earth', colors: { heroBg: '#6b4a35', heroPattern: '#836755', accent: '#f2c98a', ring: '#e09040', subtitle: '#6b4a35', iconCircle: '#6b4a35', bodyText: '#262626', footerBg: '#6b4a35' } },
  { name: 'Bold Red', colors: { heroBg: '#b32d1c', heroPattern: '#bf4f40', accent: '#efda87', ring: '#e09040', subtitle: '#b32d1c', iconCircle: '#b32d1c', bodyText: '#262626', footerBg: '#b32d1c' } },
  { name: 'Forest', colors: { heroBg: '#1b4332', heroPattern: '#3f6153', accent: '#e8c96a', ring: '#52b788', subtitle: '#1b4332', iconCircle: '#1b4332', bodyText: '#262626', footerBg: '#1b4332' } },
  { name: 'Slate Pro', colors: { heroBg: '#334155', heroPattern: '#545f70', accent: '#e2e8f0', ring: '#94a3b8', subtitle: '#334155', iconCircle: '#334155', bodyText: '#262626', footerBg: '#334155' } },
  { name: 'Sunrise', colors: { heroBg: '#9a3412', heroPattern: '#aa5438', accent: '#fbbf24', ring: '#fbbf24', subtitle: '#9a3412', iconCircle: '#9a3412', bodyText: '#262626', footerBg: '#9a3412' } },
]
