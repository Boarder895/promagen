import * as React from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

export function Button({ variant = 'default', fullWidth, className, ...props }: ButtonProps) {
  const base = 'px-3 py-2 rounded-md text-sm';
  const variantClass =
    variant === 'secondary' ? 'bg-gray-100 text-gray-900' :
    variant === 'outline'   ? 'border border-gray-300'   :
    variant === 'ghost'     ? 'bg-transparent'           :
                              'bg-gray-900 text-white';
  const width = fullWidth ? 'w-full' : '';
  return <button className={[base, variantClass, width, className].filter(Boolean).join(' ')} {...props} />;
}
export default Button;
