// FRONTEND • NEXT.JS
// File: frontend/components/CopyButton.tsx
'use client';

import { useState } from 'react';

export default function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
      className="rounded-md border px-2 py-1 text-xs hover:bg-gray-50"
      title={value}
    >
      {done ? 'Copied' : label}
    </button>
  );
}
