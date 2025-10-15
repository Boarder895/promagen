import * as React from 'react';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={['rounded-lg border p-4', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={['mb-2', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={['mt-2', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={['text-sm', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={['font-semibold', className].filter(Boolean).join(' ')} {...props} />;
}
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={['text-gray-500', className].filter(Boolean).join(' ')} {...props} />;
}
export default Card;
