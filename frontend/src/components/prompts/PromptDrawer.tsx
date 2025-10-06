"use client";

import * as React from "react";
import { usePrompts, type Prompt } from "@/lib/hooks/usePrompts";

export type PromptDrawerProps = {
  params?: Record<string, unknown>;
  allPrompts: Prompt[];
  title?: string;
};

export const PromptDrawer = ({
  params = {},
  allPrompts,
  title = "Prompts",
}: PromptDrawerProps) => {
  const { filtered, loading, error } = usePrompts({ params, allPrompts });

  if (error) {
    return (
      <aside className="rounded-xl border p-4 text-red-800 bg-red-50">
        Error: {error.message}
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="rounded-xl border p-4">
        <div className="h-3 w-24 rounded bg-gray-200 animate-pulse" />
      </aside>
    );
  }

  if (!filtered || filtered.length === 0) {
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
        {filtered.map((p) => (
          <li
            key={p.id}
            className="rounded-lg border p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="text-sm font-medium">{p.title}</div>
            <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">
              {p.text}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
};




