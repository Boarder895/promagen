'use client';

import { useState } from 'react';

export default function RequestIdCopy({
  id,
  label = 'X-Request-ID',
}: {
  id?: string;
  label?: string;
}) {
  const [ok, setOk] = useState<boolean | null>(null);
  if (!id) return null;
  return (
    <div className="flex items-center gap-2">
      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
        {label}: {id}
      </code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(id);
            setOk(true);
            setTimeout(() => setOk(null), 1500);
          } catch {
            setOk(false);
            setTimeout(() => setOk(null), 1500);
          }
        }}
        className="text-xs border px-2 py-1 rounded hover:bg-gray-50"
      >
        Copy
      </button>
      {ok === true && <span className="text-xs text-green-600">copied</span>}
      {ok === false && <span className="text-xs text-red-600">failed</span>}
    </div>
  );
}
