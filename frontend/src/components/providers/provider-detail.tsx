// src/components/providers/provider-detail.tsx

import React from 'react';
import Link from 'next/link';
import type { Provider } from '@/types/provider';

type ProviderWithCopy = Provider & {
  tagline?: string;
  tip?: string;
};

export type ProviderDetailProps = {
  provider: Provider | null;
  id: string;
};

function trendLabel(trend?: Provider['trend']): string {
  if (trend === 'up') return 'Trending up';
  if (trend === 'down') return 'Trending down';
  if (trend === 'flat') return 'No significant change';
  return 'No trend data';
}

function trendGlyph(trend?: Provider['trend']): string {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  if (trend === 'flat') return '■';
  return '•';
}

export default function ProviderDetail({ provider, id }: ProviderDetailProps): JSX.Element {
  if (!provider) {
    return (
      <article
        aria-label="Unknown provider"
        className="rounded-2xl bg-white/90 p-4 ring-1 ring-amber-200 shadow-sm"
      >
        <header className="mb-2">
          <h1 className="text-2xl font-semibold break-all">{id}</h1>
        </header>
        <p className="text-sm text-slate-700">
          This provider is not in the current Promagen catalogue. Check the URL or choose a provider
          from the main leaderboard.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Hint: visit{' '}
          <Link href="/providers" className="text-sky-600 hover:underline">
            the providers page
          </Link>{' '}
          to see all indexed providers.
        </p>
      </article>
    );
  }

  const full = provider as ProviderWithCopy;
  const name = provider.name;
  const description = full.tagline || full.tip || '';
  const score =
    typeof provider.score === 'number' && Number.isFinite(provider.score) ? provider.score : null;
  const trend = provider.trend;
  const tags = Array.isArray(provider.tags) ? provider.tags : [];

  const externalHref =
    (provider.affiliateUrl ?? provider.url) && (provider.affiliateUrl ?? provider.url)!.length > 0
      ? (provider.affiliateUrl ?? provider.url)!
      : null;

  const requiresDisclosure = provider.requiresDisclosure === true;

  return (
    <article
      aria-label={`Provider detail for ${name}`}
      className="space-y-4 rounded-2xl bg-white/95 p-5 ring-1 ring-slate-200 shadow-sm"
    >
      <header>
        <p className="text-xs uppercase tracking-wide text-slate-500">AI Provider</p>
        <h1 className="mt-1 text-2xl font-semibold">{name}</h1>
        {provider.country && <p className="text-sm text-slate-500">Based in {provider.country}</p>}
        {description && <p className="mt-2 text-sm text-slate-700">{description}</p>}

        {requiresDisclosure && (
          <p className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
            Affiliate relationship – disclosure required
          </p>
        )}
      </header>

      <section
        aria-label="Score and trend"
        className="flex flex-wrap items-baseline justify-between gap-3"
      >
        <div className="flex items-baseline gap-2">
          <p className="text-sm text-slate-600">
            Promagen score{' '}
            <span className="tabular-nums text-xl font-semibold">
              {score !== null ? score : '—'}
            </span>
          </p>
          {trend && (
            <span
              aria-label={trendLabel(trend)}
              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              <span aria-hidden="true" className="mr-1">
                {trendGlyph(trend)}
              </span>
              {trend}
            </span>
          )}
        </div>

        {provider.url && (
          <p className="text-xs text-slate-500">
            Official site:{' '}
            <a
              href={provider.url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sky-600 hover:underline"
            >
              {provider.url}
            </a>
          </p>
        )}
      </section>

      {tags.length > 0 && (
        <section aria-label="Provider tags" className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
            >
              {tag}
            </span>
          ))}
        </section>
      )}

      <section aria-label="Provider actions" className="flex flex-wrap gap-3">
        <Link
          href={`/providers/${provider.id}/prompt-builder`}
          className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Craft an image prompt
        </Link>

        {externalHref && (
          <a
            href={externalHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Visit provider site
          </a>
        )}
      </section>
    </article>
  );
}
