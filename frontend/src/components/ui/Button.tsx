'use client';

import * as React from 'react';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** keep the variants pages already use */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
};

function Button({ variant = 'default', className = '', ...rest }: ButtonProps) {
  // intentionally minimal – just keep className pass-through working
  const v =
    variant === 'outline'
      ? 'border border-current'
      : variant === 'ghost'
      ? 'bg-transparent'
      : variant === 'secondary'
      ? 'bg-zinc-800 text-white'
      : 'bg-black text-white';

  return <button className={`${v} rounded px-3 py-2 ${className}`} {...rest} />;
}

export default Button;
// also allow: import { Button } from '@/components/ui/button'
export { Button };
