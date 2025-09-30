"use client";

import React from "react";
import { usePrompts, type Prompt } from "@/hooks/usePrompts";

export type PromptDrawerProps<T extends Prompt = Prompt> = {
  params?: Record<string, string | string[] | undefined>;
  allPrompts: T[];
  limit?: number;
  title?: string;
};

export function PromptDrawer<T extends Prompt>({
  params = {},
  allPrompts,
  limit = 5,
  title = "Latest",
}: PromptDrawerProps<T>) {
  const { filtered } = usePrompts<T>({ params, allPrompts });

  if (!Array.isArray(filtered) || filtered.length === 0) {
    return (
      <aside className="p-3 border-l">
        <h3 className="font-semibold mb-2">{title}</h3>
        <p className="text-sm opacity-70">No prompts yet.</p>
      </aside>
    );
  }

  return (
    <aside className="p-3 border-l">
      <h3 className="font-semibold mb-2">{title}</h3>
      <ul className="space-y-2">
        {filtered.slice(0, limit).map((p) => (
          <li key={String(p.id)} className="text-sm">
            {p.title ?? "Untitled prompt"}
          </li>
        ))}
      </ul>
    </aside>
  );
}
