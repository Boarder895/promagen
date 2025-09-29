'use client'

import * as React from 'react'

export type ChipType = 'real' | 'disabled' | 'simulated' | 'copy'

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual/state variant */
  type: ChipType
  /** Optional custom label; defaults to a sensible label per type */
  label?: string
}

const LABELS: Record<ChipType, string> = {
  real: 'real',
  copy: 'copy',
  simulated: 'simulated',
  disabled: 'disabled',
}

const STYLES: Record<ChipType, string> = {
  real:
    'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700',
  copy:
    'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700',
  simulated:
    'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700',
  disabled:
    'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900/30 dark:text-zinc-300 dark:border-zinc-700',
}

export function Chip({ type, label, className, ...rest }: ChipProps) {
  const text = label ?? LABELS[type]
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        STYLES[type],
        className ?? '',
      ].join(' ')}
      {...rest}
    >
      {text}
    </span>
  )
}

export default Chip
