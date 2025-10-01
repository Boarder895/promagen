"use client";

import * as React from "react";

/**
 * Simple, robust Card primitives.
 * - No polymorphic `as` prop (avoids SVG/IntrinsicElement inference chaos).
 * - Named exports only (fits your eslint policy).
 * - Forward refs for compatibility with libs.
 */

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const Card = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className = "", children, ...rest }, ref) => (
    <div
      ref={ref}
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className = "", children, ...rest }, ref) => (
    <div ref={ref} className={`p-4 border-b ${className}`} {...rest}>
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

export const CardContent = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className = "", children, ...rest }, ref) => (
    <div ref={ref} className={`p-4 ${className}`} {...rest}>
      {children}
    </div>
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, DivProps>(
  ({ className = "", children, ...rest }, ref) => (
    <div ref={ref} className={`p-4 border-t ${className}`} {...rest}>
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className = "", children, ...rest }, ref) => (
  <h3 ref={ref} className={`text-base font-semibold ${className}`} {...rest}>
    {children}
  </h3>
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className = "", children, ...rest }, ref) => (
  <p ref={ref} className={`text-sm text-slate-600 ${className}`} {...rest}>
    {children}
  </p>
));
CardDescription.displayName = "CardDescription";

/** Back-compat alias so existing imports keep working */
export { CardContent as CardBody };



