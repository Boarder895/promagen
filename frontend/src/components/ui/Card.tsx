'use client';

import * as React from 'react';

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', ...props }: DivProps) {
  return <div className={`rounded-lg border bg-white text-black ${className}`} {...props} />;
}

export function CardHeader({ className = '', ...props }: DivProps) {
  return <div className={`p-4 border-b ${className}`} {...props} />;
}

export function CardTitle({ className = '', ...props }: DivProps) {
  return <div className={`text-base font-semibold leading-none tracking-tight ${className}`} {...props} />;
}

export function CardDescription({ className = '', ...props }: DivProps) {
  return <div className={`text-sm text-gray-500 ${className}`} {...props} />;
}

export function CardContent({ className = '', ...props }: DivProps) {
  return <div className={`p-4 ${className}`} {...props} />;
}

export function CardFooter({ className = '', ...props }: DivProps) {
  return <div className={`p-4 border-t ${className}`} {...props} />;
}

// default + named (so `import Card, { CardFooter }` works)
export default Card;

