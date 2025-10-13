"use client";

import * as React from "react";
import { usePrompts, type Prompt } from "@/lib/hooks/usePrompts";

export type PromptGridProps = {
  params?: Record<string, unknown>;
  allPrompts: Prompt[];
  title?: string;
};

export const PromptGrid = ({
  params = {},
  allPrompts,
  title = "Prompts",
}: PromptGridProps) => {
  const { filtered, loading, error } = usePrompts({ params, allPrompts });

  if (error) {
    return <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
      <div className="font-semibold">Couldn�t load prompts</div>
      <div className="text-sm opacity-80">{error.message}</div>
    </div>;
  }

  if (loading) {
    return (
      <div className="rounded-xl border p-4">
        <div className="h-4 w-24 rounded bg-gray-200 mb-3 animate-pulse" />
        <div className="space-y-2">
          <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!filtered || filtered.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-gray-600">
        <p className="text-sm opacity-70">No prompts match your search.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <li key={p.id} className="rounded-2xl border p-4 shadow-sm hover:shadow transition-shadow">
            <div className="font-medium">{p.title}</div>
            <p className="mt-1 text-sm text-gray-600 line-clamp-3">{p.text}</p>
            {p.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs rounded-full border px-2 py-0.5">{t}</span>
                ))}
              </div>
            ) : null}
            {p.href ? <a href={p.href} className="mt-3 inline-block text-sm underline">View</a> : null}
          </li>
        ))}
      </ul>
    </section>
  );
};


