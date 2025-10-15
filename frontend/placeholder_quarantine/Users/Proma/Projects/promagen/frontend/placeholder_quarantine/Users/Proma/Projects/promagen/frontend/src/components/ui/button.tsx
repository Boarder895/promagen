import * as React from 'react';
import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type Variant = 'default' | 'secondary' | 'outline' | 'ghost';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    const styles: Record<Variant, string> = {
      default:
        'bg-black text-white hover:bg-black/90 border border-black',
      secondary:
        'bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300',
      outline:
        'bg-transparent text-gray-900 border border-gray-300 hover:bg-gray-50',
      ghost:
        'bg-transparent text-gray-700 hover:bg-gray-100 border border-transparent',
    };

    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-black/20',
          styles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export default Button;
