// FRONTEND - NEXT.JS (App Router)
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
      <div
        role="alert"
        className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800"
      >
        <div className="font-semibold">Could not load prompts</div>
        <div className="text-sm opacity-80">{error.message}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border p-4">
        <div className="mb-3 h-4 w-24 rounded bg-gray-200 animate-pulse" />
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
        <div className="mt-1 text-sm opacity-80">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white">
      <div className="mb-3 flex items-centre gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>

      <ul className="space-y-3">
        {prompts.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-white/10 bg-black/30 p-3"
          >
            <div className="flex items-centre justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{p.title}</div>
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-white/70">
                    {p.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 px-2 py-[1px]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-white/80 whitespace-pre-line">
              {p.text}
            </p>
            {p.href ? (
              <a
                href={p.href}
                className="mt-3 inline-block text-sm underline"
              >
                View
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
};
