'use client';

import * as React from 'react';
import useProgress from './ProgressProvider'; // default export

export default function ProgressToast() {
  const { jobs = [] } = useProgress();

  if (!jobs.length) return null;

  return (
    <div className="fixed bottom-3 right-3 w-80 space-y-2">
      {jobs.slice(0, 5).map((j: any) => (
        <div
          key={j.id}
          className="rounded-lg border bg-white p-3 shadow-sm"
        >
          <div className="text-sm font-medium">
            {j.label ?? 'Job running'}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            {j.status ?? 'working…'}
          </div>
          {typeof j.progress === 'number' && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-gray-200">
              <div
                className="h-full bg-black transition-[width]"
                style={{ width: `${Math.min(100, Math.max(0, j.progress))}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}



