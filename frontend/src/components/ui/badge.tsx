import * as React from 'react';

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'danger' | 'warning';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const base =
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium select-none whitespace-nowrap';

const variants: Record<Variant, string> = {
  default:  'bg-gray-900 text-white',
  secondary:'bg-gray-200 text-gray-900',
  outline:  'border border-gray-300 text-gray-800 bg-white',
  success:  'bg-green-600 text-white',
  danger:   'bg-red-600 text-white',
  warning:  'bg-yellow-500 text-black',
};

const cx = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant = 'default', ...props },
  ref
) {
  return <span ref={ref} className={cx(base, variants[variant], className)} {...props} />;
});

