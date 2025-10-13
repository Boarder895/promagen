// FRONTEND · NEXT.JS (App Router)
// NEW FILES: Paste these into your frontend project.
// Tailwind required. Uses the color tokens/radii/shadows from the Design System v0.1.
// All components are dependency-free (no shadcn required) but styled to be drop-in.

// ───────────────────────────────────────────────────────────────────────────────
// File: frontend/src/components/ui/Button.tsx  (NEW)
// ───────────────────────────────────────────────────────────────────────────────
import * as React from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
};

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  leftIcon,
  rightIcon,
  fullWidth,
  ...props
}) => {
  const base = 'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-medium transition disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 shadow-card active:translate-y-[1px]';
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    secondary: 'bg-white text-primary-700 border border-slate-200 hover:bg-primary-50',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    destructive: 'bg-danger-600 text-white hover:bg-danger-600/90',
  };
  return (
    <button
      className={clsx(base, variants[variant], fullWidth && 'w-full', className)}
      {...props}
    >
      {leftIcon && <span className="grid place-items-center" aria-hidden>{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="grid place-items-center" aria-hidden>{rightIcon}</span>}
    </button>
  );
};


