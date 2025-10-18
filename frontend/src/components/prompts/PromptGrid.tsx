// src/components/prompts/PromptGrid.tsx
// Renders a simple grid of prompt cards.

import React from "react";
import type { Prompt } from "@/lib/hooks/usePrompts";

export type PromptGridProps = {
  _params?: Record<string, string | string[]>;
  allPrompts: Prompt[];
  title?: string;
};

export function PromptGrid({ _params, allPrompts, title }: PromptGridProps) {
  void _params; // reserved for future filtering; keeps prop stable for Stage 2

  const items = Array.isArray(allPrompts) ? allPrompts : [];

  return (
    <section className="space-y-3">
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prompts yet.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4">
          {items.map((p) => (
            <li key={p.id} className="rounded border p-3">
              <div className="font-medium">{p.title ?? "Untitled"}</div>
              {p.description ? (
                <div className="text-xs text-muted-foreground">{p.description}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PromptGrid;






