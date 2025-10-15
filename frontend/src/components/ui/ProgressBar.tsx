import * as React from 'react';

export default function ProgressBar({ value = 0, className = '' }: { value?: number; className?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={['h-2 w-full rounded bg-gray-200', className].join(' ')}>
      <div className="h-2 rounded bg-gray-900" style={{ width: `${v}%` }} />
    </div>
  );
}
