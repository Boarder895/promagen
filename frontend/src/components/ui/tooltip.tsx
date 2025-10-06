import * as React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

/**
 * Wrapper div for tooltip target. Supports shadcn-style asChild prop
 * (for compatibility with <TooltipTrigger asChild><button/></TooltipTrigger>)
 */
export const TooltipTrigger = React.forwardRef<
  HTMLDivElement,
  DivProps & { asChild?: boolean }
>(function TooltipTrigger({ asChild, children, className, ...props }, ref) {
  // If asChild is true, clone the single child so it inherits tooltip trigger behavior.
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      ref,
      className: [className, (children as any).props?.className].filter(Boolean).join(' '),
      ...props,
    });
  }

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
});

export const Tooltip = ({ children }: { children: React.ReactNode }) => (
  <div className="relative inline-block group">{children}</div>
);

export const TooltipContent = React.forwardRef<HTMLDivElement, DivProps>(function TooltipContent(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="tooltip"
      className={[
        'pointer-events-none absolute z-50 hidden max-w-xs rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-800 shadow-md',
        'group-hover:block',
        'left-1/2 -translate-x-1/2 translate-y-2',
        'whitespace-pre-line',
        className,
      ].join(' ')}
      {...props}
    />
  );
});

