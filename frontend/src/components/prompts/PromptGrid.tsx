// Renders a simple grid of prompt cards.
// Accepts the same Prompt type you use on the page.

import React from "react";
import type { Prompt } from "@/lib/hooks/usePrompts";

export type PromptGridProps = {
  params?: Record<string, string | string[]>;
  allPrompts: Prompt[];
  title?: string;
};

export function PromptGrid({ params, allPrompts, title }: PromptGridProps) {
  const items = Array.isArray(allPrompts) ? allPrompts : [];

  return (
    <section className="space-y-4">
      {title ? (
        <h2 className="text-lg font-medium">
          {title} <span className="opacity-60">({items.length})</span>
        </h2>
      ) : null}

      {items.length === 0 ? (
        <p className="opacity-70">No prompts found.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id} className="rounded-xl border p-3">
              <div className="font-medium">{p.title}</div>
              {p.text ? (
                <p className="text-sm opacity-80 mt-1 whitespace-pre-wrap">
                  {p.text}
                </p>
              ) : null}
              {p.prompt ? (
                <pre className="text-xs opacity-70 mt-2 whitespace-pre-wrap">
                  {p.prompt}
                </pre>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Allow both named and default import styles.
export default PromptGrid;
