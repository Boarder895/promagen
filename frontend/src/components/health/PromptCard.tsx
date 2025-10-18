'use client';
import React from 'react';
import type { Prompt } from '@/lib/hooks/usePrompts';

type Props = { prompt: Prompt } | { p: Prompt };

export { type Prompt }; // so pages can `import { Prompt } from '@/components/PromptCard'`

export default function PromptCard(props: Props) {
  const prompt = 'prompt' in props ? props.prompt : props.p;
  return (
    <article className="rounded border p-3">
      <h3 className="font-medium">{prompt.title}</h3>
      <p className="text-sm opacity-80 whitespace-pre-wrap">{prompt.text || prompt.prompt}</p>
      {prompt.tags?.length ? <div className="mt-2 text-xs opacity-60">#{prompt.tags.join('  #')}</div> : null}
    </article>
  );
}




