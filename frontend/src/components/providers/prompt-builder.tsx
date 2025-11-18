// frontend/src/components/providers/prompt-builder.tsx
'use client';

import React from 'react';
import Link from 'next/link';

import type { Provider } from '@/types/provider';
import { isPaidUser } from '@/lib/user-plan';
import {
  DEFAULT_FINANCE_WIDGET_PREFS,
  loadFinanceWidgetPrefs,
  saveFinanceWidgetPrefs,
} from '@/lib/ribbon/micro-widget-prefs';
import type { FinanceWidgetPrefs } from '@/lib/ribbon/micro-widget-prefs';
import PromptFinanceToggles from '@/components/providers/prompt-finance-toggles';
import MiniFxWidget from '@/components/ribbon/mini-fx-widget';
import MiniCommoditiesWidget from '@/components/ribbon/mini-commodities-widget';
import MiniCryptoWidget from '@/components/ribbon/mini-crypto-widget';
import { buildPrompt } from '@/lib/prompt-builder';

export type PromptBuilderProps = {
  provider: Provider;
};

type CopyState = 'idle' | 'copied';

export default function PromptBuilder({ provider }: PromptBuilderProps): JSX.Element {
  const [idea, setIdea] = React.useState<string>('');
  const [negative, setNegative] = React.useState<string>('');
  const [aspect, setAspect] = React.useState<string>('');
  const [seed, setSeed] = React.useState<string>('');
  const [styleTag, setStyleTag] = React.useState<string>('');
  const [copyState, setCopyState] = React.useState<CopyState>('idle');

  const [financePrefs, setFinancePrefs] = React.useState<FinanceWidgetPrefs>(() => {
    if (typeof window === 'undefined') return DEFAULT_FINANCE_WIDGET_PREFS;
    return loadFinanceWidgetPrefs();
  });

  const paid = isPaidUser();

  const built = React.useMemo(
    () =>
      buildPrompt(
        provider.id,
        { idea, negative, aspect, seed, styleTag },
        provider.affiliateUrl ?? provider.url,
      ),
    [provider.id, provider.affiliateUrl, provider.url, idea, negative, aspect, seed, styleTag],
  );

  const hrefProvider = `/providers/${provider.id}`;
  const hrefExternal = built.deepLink ?? provider.affiliateUrl ?? provider.url ?? '#';

  const handleCopy = async (): Promise<void> => {
    if (!built.text) return;

    try {
      if (typeof navigator !== 'undefined' && 'clipboard' in navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(built.text);
      }
      setCopyState('copied');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setCopyState('idle'), 1500);
      }
    } catch {
      // Silent failure: at worst, the button just does nothing.
    }
  };

  const handleFinancePrefsChange = (next: FinanceWidgetPrefs): void => {
    setFinancePrefs(next);
    saveFinanceWidgetPrefs(next);
  };

  return (
    <section aria-label="Prompt editor" className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold" aria-label="Prompt Builder">
          Prompt Builder
        </h1>
        <p className="text-sm text-slate-600">
          Craft an image prompt tailored for <span className="font-medium">{provider.name}</span>.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)]">
        {/* Left: prompt controls + text area */}
        <div className="space-y-4">
          {/* Core idea */}
          <div className="space-y-1.5">
            <label htmlFor="prompt-idea" className="block text-xs font-medium text-slate-700">
              Prompt idea
            </label>
            <input
              id="prompt-idea"
              type="text"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder="A tiny astronaut exploring a glowing forest..."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {/* Negative prompt */}
          <div className="space-y-1.5">
            <label htmlFor="prompt-negative" className="block text-xs font-medium text-slate-700">
              Negative prompt (optional)
            </label>
            <input
              id="prompt-negative"
              type="text"
              value={negative}
              onChange={(event) => setNegative(event.target.value)}
              placeholder="No text, no watermarks, no distortion..."
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {/* Presets row: aspect, style, seed */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="prompt-aspect" className="block text-xs font-medium text-slate-700">
                Aspect ratio
              </label>
              <select
                id="prompt-aspect"
                value={aspect}
                onChange={(event) => setAspect(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Provider default</option>
                <option value="1:1">Square 1:1</option>
                <option value="16:9">Wide 16:9</option>
                <option value="9:16">Vertical 9:16</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prompt-style" className="block text-xs font-medium text-slate-700">
                Style tag
              </label>
              <select
                id="prompt-style"
                value={styleTag}
                onChange={(event) => setStyleTag(event.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              >
                <option value="">Neutral</option>
                <option value="cinematic">Cinematic</option>
                <option value="illustration">Illustration</option>
                <option value="photographic">Photographic</option>
                <option value="concept-art">Concept art</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="prompt-seed" className="block text-xs font-medium text-slate-700">
                Seed (optional)
              </label>
              <input
                id="prompt-seed"
                type="text"
                inputMode="numeric"
                value={seed}
                onChange={(event) => setSeed(event.target.value)}
                placeholder="Random or fixed number"
                className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
              />
            </div>
          </div>

          {/* Built prompt */}
          <div className="space-y-2">
            <label htmlFor="prompt-output" className="block text-xs font-medium text-slate-700">
              Image prompt editor
            </label>
            <textarea
              id="prompt-output"
              aria-label="Image prompt editor"
              value={built.text}
              readOnly
              className="min-h-[160px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-0 focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
              >
                {copyState === 'copied' ? 'Copied' : 'Copy prompt'}
              </button>

              <Link
                href={hrefProvider}
                className="text-xs font-medium text-slate-700 underline-offset-4 hover:underline"
                aria-label={`Back to provider details for ${provider.name}`}
              >
                Back to provider
              </Link>
            </div>

            <a
              href={hrefExternal}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
            >
              Open in {provider.name}
            </a>
          </div>
        </div>

        {/* Right: plan-aware finance widgets */}
        {paid && (
          <aside className="space-y-3">
            <PromptFinanceToggles
              prefs={financePrefs}
              onChange={handleFinancePrefsChange}
              isPaid={paid}
            />
            <div className="space-y-3">
              {financePrefs.fx && <MiniFxWidget />}
              {financePrefs.commodities && <MiniCommoditiesWidget />}
              {financePrefs.crypto && <MiniCryptoWidget />}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
}
