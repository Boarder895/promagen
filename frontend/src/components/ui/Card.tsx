// ───────────────────────────────────────────────────────────────────────────────
// File: frontend/src/components/ui/Card.tsx  (NEW)
// ───────────────────────────────────────────────────────────────────────────────
import * as React from 'react';
import clsx from 'clsx';

type CardProps = React.HTMLAttributes<HTMLDivElement> & { as?: keyof JSX.IntrinsicElements };

export const Card: React.FC<CardProps> = ({ as: Tag = 'div', className, children, ...rest }) => (
  <Tag className={clsx('rounded-2xl bg-white shadow-card border border-slate-200', className)} {...rest}>
    {children}
  </Tag>
);

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={clsx('flex items-start justify-between gap-3 p-6 pb-0', className)} {...rest}>{children}</div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={clsx('p-6', className)} {...rest}>{children}</div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...rest }) => (
  <div className={clsx('p-6 pt-0 flex items-center justify-between', className)} {...rest}>{children}</div>
);
