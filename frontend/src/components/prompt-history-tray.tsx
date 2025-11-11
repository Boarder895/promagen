'use client';

import { useEffect, useState } from 'react';
import { getCopyHistory } from '@/lib/prompt-rehydration';
import type { CopyMeta } from '@/lib/prompt-rehydration';

export function PromptHistoryTray() {
  const [log, setLog] = useState<CopyMeta[]>([]);

  useEffect(() => {
    const sync = () => setLog(getCopyHistory());
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);

  if (log.length === 0) {return null;}

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-4 mt-4">
      <h2 className="text-sm font-semibold text-zinc-200 mb-3">?? Recent Prompts</h2>
      <ul className="space-y-1 text-sm text-zinc-300">
        {log.map((entry, i) => (
          <li key={i} className="truncate">
            <span className="font-medium">{entry.providerName}</span> ·{' '}
            {new Date(entry.ts).toLocaleTimeString()} —{' '}
            <span className="ml-1 text-zinc-400">{entry.prompt.slice(0, 60)}…</span>
          </li>
        ))}
      </ul>
    </div>
  );
}



