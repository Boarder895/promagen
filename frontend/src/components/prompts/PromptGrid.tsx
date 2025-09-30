"use client";

import React from "react";
import { usePrompts, type Prompt } from "@/hooks/usePrompts";

export type PromptGridProps<T extends Prompt = Prompt> = {
  params?: Record<string, string | string[] | undefined>;
  allPrompts: T[];
  title?: string;
};

export function PromptGrid<T extends Prompt>({ params = {}, allPrompts, title = "Prompts" }: PromptGridProps<T>) {
  const { filtered } = usePrompts<T>({ params, allPrompts });

  return (
    <section className="p-4">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {filtered.length === 0 ? (
        <p className="text-sm opacity-70">No prompts match your search.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => (
            <article key={String(p.id)} className="border rounded-xl p-3">
              <h3 className="font-medium">{p.title ?? "Untitled prompt"}</h3>
              <p className="text-sm opacity-80 line-clamp-3 mt-1">{p.text ?? p.prompt ?? ""}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
