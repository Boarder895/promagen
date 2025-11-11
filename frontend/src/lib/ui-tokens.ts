// Shared design tokens used across components.
// Keep these minimal and stable; Tailwind still does heavy lifting.

export const colour = {
  bgPanel: 'bg-white/5',
  borderQuiet: 'border-white/10',
  textQuiet: 'text-white/70',
  textQuietDim: 'text-white/60',
  textStrong: 'text-white',
  focus: 'ring-sky-400'
} as const;

export const motion = {
  fadeMs: 150,
  fadeClass: 'transition-opacity duration-150 ease-linear'
} as const;

export const typography = {
  numbers: 'tabular-nums',
  small: 'text-xs',
  label: 'text-sm font-semibold'
} as const;

export const testids = {
  eastRail: 'east-rail',
  westRail: 'west-rail',
  providersGrid: 'providers-grid',
  financeRibbon: 'finance-ribbon'
} as const;
