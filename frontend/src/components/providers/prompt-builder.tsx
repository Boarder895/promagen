// src/components/providers/prompt-builder.tsx

'use client';

import React from 'react';

export interface PromptBuilderProvider {
  id?: string;
  name: string;
  /**
   * Preferred website URL property for the provider.
   */
  websiteUrl?: string;
  /**
   * Alias used by the core Provider type (`url`).
   * We support both so the component can receive a full Provider object
   * without extra mapping.
   */
  url?: string;
  description?: string;
  tags?: string[];
}

export interface PromptBuilderProps {
  /**
   * Optional id for analytics / DOM anchoring.
   * If omitted, we fall back to provider.id or a generic value.
   */
  id?: string;
  provider: PromptBuilderProvider;
}

export function PromptBuilder(props: PromptBuilderProps) {
  const { provider } = props;

  const id =
    props.id ?? provider.id ?? `prompt-builder-${provider.name.toLowerCase().replace(/\s+/g, '-')}`;

  const websiteUrl = provider.websiteUrl ?? provider.url;
  const textareaId = `${id}-textarea`;

  const handleCopyPrompt = () => {
    if (typeof document === 'undefined') return;

    const textarea = document.getElementById(textareaId) as HTMLTextAreaElement | null;

    if (!textarea) return;

    const value = textarea.value ?? '';
    if (!value) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {
        // Swallow clipboard errors in tests / unsupported browsers.
      });
    }
  };

  return (
    <section
      id={id}
      aria-label={`Prompt builder for ${provider.name}`}
      className="flex flex-col gap-4 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 md:p-6"
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-50">{provider.name} · Prompt builder</h2>
        {provider.description ? (
          <p className="text-sm text-slate-400">{provider.description}</p>
        ) : null}
        {provider.tags && provider.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {provider.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-slate-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {/* Dedicated region for the prompt editor – the routes test looks for
         getByRole('region', { name: /prompt editor/i }). */}
      <section aria-label="Prompt editor" className="flex flex-col gap-3">
        {/* Main image prompt editor */}
        <label className="flex flex-col gap-1" htmlFor={textareaId}>
          <span className="text-xs font-medium text-slate-300">Image prompt editor</span>
          <textarea
            id={textareaId}
            rows={6}
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            placeholder={`Write a prompt to run on ${provider.name}…`}
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Copy prompt action required by the smoke + routes tests */}
          <button
            type="button"
            onClick={handleCopyPrompt}
            className="inline-flex items-center justify-center rounded-full border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-700/60"
          >
            Copy prompt
          </button>

          {websiteUrl ? (
            <a
              href={websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-sky-500 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-500/10"
            >
              Open in {provider.name}
            </a>
          ) : null}
        </div>

        {websiteUrl ? (
          <p className="text-[0.7rem] text-slate-400">
            Prompts are crafted here; execution happens on the provider.
          </p>
        ) : null}
      </section>
    </section>
  );
}

export default PromptBuilder;
