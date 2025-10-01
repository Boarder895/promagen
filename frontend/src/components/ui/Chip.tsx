// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// File: frontend/src/components/ui/Chip.tsx  (NEW)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import * as React from 'react';
import clsx from 'clsx';

type ChipTone = 'default' | 'api' | 'copy' | 'affiliate' | 'success' | 'warning' | 'danger';

type ChipProps = {
  children: React.ReactNode;
  tone?: ChipTone;
  className?: string;
};

const toneClass: Record<ChipTone, string> = {
  default: 'bg-slate-100 text-slate-700',
  api: 'bg-secondary-600/10 text-secondary-700 ring-1 ring-secondary-600/20',
  copy: 'bg-accent-500/10 text-accent-600 ring-1 ring-accent-500/20',
  affiliate: 'bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20',
  success: 'bg-success-600/10 text-success-700 ring-1 ring-success-600/20',
  warning: 'bg-warning-600/10 text-warning-700 ring-1 ring-warning-600/20',
  danger: 'bg-danger-600/10 text-danger-700 ring-1 ring-danger-600/20',
};

export const Chip: React.FC<ChipProps> = ({ children, tone = 'default', className }) => (
  <span className={clsx('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', toneClass[tone], className)}>
    {children}
  </span>
);


