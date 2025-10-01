// FRONTEND � NEXT.JS (App Router)
// Named exports only

import * as React from "react";

export type Prompt = {
  id: string;
  title: string;
  text: string;
  tags?: string[];
  href?: string;
};

type PromptObject = {
  /** Preferred if present */
  filtered?: Prompt[];
  /** Alternate shapes we sometimes pass around */
  allPrompts?: Prompt[];
  all?: Prompt[];
};

type PromptsSource = Prompt[] | PromptObject;

export type PromptsProps = {
  title?: string;
  /** Accepts either an array of prompts or an object with { filtered | allPrompts | all } */
  data: PromptsSource;
  loading?: boolean;
  error?: Error | null;
  emptyMessage?: string;
};

function getPrompts(src: PromptsSource): Prompt[] {
  if (Array.isArray(src)) return src;
  if ("filtered" in src && src.filtered) return src.filtered;
  if ("allPrompts" in src && src.allPrompts) return src.allPrompts;
  if ("all" in src && src.all) return src.all;
  return [];
}

export const Prompts = ({
  title = "Latest",
  data,
  loading = false,
  error = null,
  emptyMessage = "No prompts yet.",
}: PromptsProps) => {
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800">
        <div className="font-semibold">Couldn�t load prompts</div>
        <div className="text-sm opacity-80">{error.message}</div>
      </div>
    );
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

  const prompts = getPrompts(data);

  if (!prompts.length) {
    return (
      <div className="rounded-xl border p-4 text-gray-600">
        <div className="font-medium">{title}</div>
        <div className="text-sm opacity-80 mt-1">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-xl font-semibold">{title}</h2>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prompts.map((p) => (
          <li key={p.id} className="rounded-2xl border p-4 shadow-sm hover:shadow transition-shadow">
            <div className="font-medium">{p.title}</div>
            <p className="mt-1 text-sm text-gray-600 line-clamp-3">{p.text}</p>
            {p.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.map((t) => (
                  <span key={t} className="text-xs rounded-full border px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            {p.href ? (
              <a href={p.href} className="mt-3 inline-block text-sm underline">
                View
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};


