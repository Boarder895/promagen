'use client';

import * as React from 'react';

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  color?: 'gray' | 'green' | 'red' | 'blue';
};

function Chip({ className = '', color = 'gray', ...props }: ChipProps) {
  const map = {
    gray: 'bg-gray-200 text-gray-800',
    green: 'bg-green-200 text-green-800',
    red: 'bg-red-200 text-red-800',
    blue: 'bg-blue-200 text-blue-800',
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[color]} ${className}`}
      {...props}
    />
  );
}

export { Chip };
export default Chip;
