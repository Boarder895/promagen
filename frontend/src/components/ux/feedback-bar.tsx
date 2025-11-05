'use client';

import { useState } from 'react';
import type { PromptQuality } from '@/types/providers';

interface Props {
  providerId: string;
  prompt: string;
}

export default function FeedbackBar({ providerId, prompt }: Props) {
  const [voted, setVoted] = useState<PromptQuality | null>(null);

  function vote(val: PromptQuality) {
    setVoted(val);
    // Stage 3: POST to /api/feedback
    try {
      const key = 'pmg.feedback';
      const raw = localStorage.getItem(key);
      const map = raw ? (JSON.parse(raw) as Record<string, PromptQuality>) : {};
      map[hash(providerId + '|' + prompt)] = val;
      localStorage.setItem(key, JSON.stringify(map));
    } catch {}
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">Was this prompt good?</span>
      <button
        type="button"
        onClick={() => vote('up')}
        className={`rounded-lg px-2 py-1 border ${voted === 'up' ? 'bg-green-50 border-green-300' : 'border-slate-200 hover:bg-slate-50'}`}
        aria-pressed={voted === 'up'}
      >
        ??
      </button>
      <button
        type="button"
        onClick={() => vote('flag')}
        className={`rounded-lg px-2 py-1 border ${voted === 'flag' ? 'bg-rose-50 border-rose-300' : 'border-slate-200 hover:bg-slate-50'}`}
        aria-pressed={voted === 'flag'}
      >
        ??
      </button>
      {voted && <span className="text-slate-500">Thanks!</span>}
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return String(h >>> 0);
}



