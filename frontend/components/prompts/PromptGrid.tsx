'use client';

import { prompts } from '@/data/prompts';

export default function PromptGrid() {
  if (!prompts?.length) {
    return <p className="text-sm opacity-70">No prompts yet.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {prompts.map((p) => (
        <div key={p.id} className="rounded-lg border p-3">
          <div className="font-medium">{p.title}</div>
          <pre className="mt-2 text-sm whitespace-pre-wrap">{p.text}</pre>
        </div>
      ))}
    </div>
  );
}
