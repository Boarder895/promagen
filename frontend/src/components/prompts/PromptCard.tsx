"use client";

import React from "react";

/**
 * Local Prompt shape (loose + forward-compatible).
 * Avoids importing a non-existent `Prompt` type from "@/lib/api".
 */
export type Prompt = {
  id?: string | number;
  title?: string;
  prompt?: string;        // main text
  negative?: string;
  provider?: string;      // provider id or name
  createdAt?: string | Date;
  tags?: string[];
  [key: string]: unknown;
};

export default function PromptCard({ item }: { item: Prompt }) {
  const title = item.title ?? "Untitled prompt";
  const body = item.prompt ?? "";
  const provider = item.provider ?? "unknown";
  const created = item.createdAt
    ? new Date(item.createdAt).toLocaleString()
    : undefined;
  const tags = Array.isArray(item.tags) ? item.tags : [];

  return (
    <article className="rounded-xl border border-zinc-200 p-4 shadow-sm">
      <header className="mb-2 flex items-center gap-2">
        <h3 className="text-base font-semibold leading-6">{title}</h3>
        <span className="ml-auto text-xs opacity-70">Provider: {provider}</span>
      </header>

      {body ? (
        <p className="text-sm opacity-90">
          {body.length > 260 ? `${body.slice(0, 260)}ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½` : body}
        </p>
      ) : (
        <p className="text-sm opacity-60">No prompt text</p>
      )}

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 8).map((t) => (
            <span key={String(t)} className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs">
              #{String(t)}
            </span>
          ))}
          {tags.length > 8 && (
            <span className="text-xs opacity-60">+{tags.length - 8} more</span>
          )}
        </div>
      )}

      {created && (
        <footer className="mt-3 text-xs opacity-60">Created: {created}</footer>
      )}
    </article>
  );
}




