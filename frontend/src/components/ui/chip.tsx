import * as React from 'react';

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: 'blue' | 'gray' | 'green' | 'red';
  /** present so older code that passed tone doesn't error */
  tone?: string;
};
export default function Chip({ color = 'gray', className, ...props }: ChipProps) {
  const colorMap = {
    blue: 'text-blue-600 border-blue-300',
    gray: 'text-gray-600 border-gray-300',
    green: 'text-green-600 border-green-300',
    red: 'text-red-600 border-red-300',
  } as const;
  return (
    <span
      className={['inline-flex items-center gap-1 text-xs rounded-full border px-2 py-0.5', colorMap[color], className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  );
}







