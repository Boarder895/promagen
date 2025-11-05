'use client';

import * as React from 'react';
import usePrompts, { type Prompt } from '@/lib/hooks/use-prompts';

export type PromptDrawerProps = {
  params?: Record<string, string>;
  allPrompts: Prompt[];
  title?: string;
};

export const PromptDrawer = ({
  params = {},
  allPrompts,
  title = 'Prompts',
}: PromptDrawerProps) => {
  const { filtered, loading, error } = usePrompts({ params, allPrompts });

  if (error) {
    return (
      <aside className="rounded-xl border bg-red-50 p-4 text-red-800">
        Error: {String((error as Error).message ?? error)}
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="rounded-xl border p-4">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
      </aside>
    );
  }

  if (!filtered?.length) {
    return (
      <aside className="rounded-xl border p-4 text-gray-600">
        <p className="text-sm opacity-70">No prompts yet.</p>
      </aside>
    );
  }

  return (
    <aside className="space-y-3">
      <div className="text-sm font-semibold">{title}</div>
      <ul className="space-y-2">
        {filtered.map((p: Prompt) => (
          <li
            key={p.id}
            className="rounded-lg border p-3 transition-colors hover:bg-gray-50"
          >
            <div className="text-sm font-medium">{p.title}</div>
            <div className="mt-0.5 line-clamp-2 text-xs text-gray-600">
              {p.text}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default PromptDrawer;










