// src/components/providers/provider-detail.tsx

import React from 'react';
import Link from 'next/link';

import type { Provider } from '@/types/provider';
import { buildGoHref } from '@/lib/affiliate/outbound';

export type ProviderDetailProps = {
  /** Provider record for this page. When null, the UI renders a safe empty state. */
  provider: Provider | null;

  /** Optional id fallback (useful when the provider record is missing). */
  id?: string;
};

function getOfficialUrlText(provider: Provider): string | null {
  return provider.url ?? provider.website ?? null;
}

function hasOutboundDestination(provider: Provider): boolean {
  return Boolean(provider.affiliateUrl ?? provider.url ?? provider.website);
}

export default function ProviderDetail(props: ProviderDetailProps) {
  const { provider, id } = props;

  const providerId = provider?.id ?? id ?? '';
  const providerName = provider?.name ?? providerId;

  if (!provider) {
    return (
      <article className="flex w-full flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-slate-50">Provider not found</h1>
          {providerId ? (
            <p className="text-sm text-slate-300">
              The provider <span className="font-mono text-slate-200">{providerId}</span> is not in
              the current catalogue.
            </p>
          ) : (
            <p className="text-sm text-slate-300">This provider is not in the current catalogue.</p>
          )}
        </header>

        <section className="flex flex-wrap items-center gap-3">
          <Link
            href="/providers/leaderboard"
            className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80"
          >
            Back to leaderboard
          </Link>
        </section>
      </article>
    );
  }

  const officialUrlText = getOfficialUrlText(provider);
  const outboundHref = providerId ? buildGoHref(providerId, 'provider_detail') : '#';

  return (
    <article className="flex w-full flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">{providerName}</h1>
        {provider.tagline ? <p className="text-sm text-slate-300">{provider.tagline}</p> : null}
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <h2 className="text-sm font-semibold text-slate-50">Quick facts</h2>
          <dl className="mt-3 grid gap-2 text-sm text-slate-300">
            <div className="flex items-start justify-between gap-2">
              <dt className="text-slate-500">Provider id</dt>
              <dd className="font-mono text-xs text-slate-200">{providerId}</dd>
            </div>

            {officialUrlText ? (
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-500">Official site</dt>
                <dd className="text-right">
                  <a
                    href={outboundHref}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sky-300 underline decoration-sky-500/50 underline-offset-4 hover:text-sky-200"
                  >
                    {officialUrlText}
                  </a>
                </dd>
              </div>
            ) : null}

            {provider.country ? (
              <div className="flex items-start justify-between gap-2">
                <dt className="text-slate-500">Country</dt>
                <dd>{provider.country}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <h2 className="text-sm font-semibold text-slate-50">Why it&apos;s on the leaderboard</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            {provider.tip ??
              'This provider appears in the catalogue. Promagen ranks providers using simple, explainable signals.'}
          </p>

          {provider.requiresDisclosure ? (
            <p className="mt-3 text-xs text-slate-400">
              This outbound button uses an affiliate link (disclosed).
            </p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Link
          href={`/providers/${providerId}/prompt-builder`}
          className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 shadow-sm hover:border-slate-400 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80"
        >
          Prompt builder
        </Link>

        {hasOutboundDestination(provider) ? (
          <a
            href={outboundHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-sky-500/70 bg-sky-600/10 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-500/10 focus-visible:outline-none focus-visible:ring focus-visible:ring-sky-400/80"
          >
            Visit provider site
          </a>
        ) : null}
      </section>
    </article>
  );
}
