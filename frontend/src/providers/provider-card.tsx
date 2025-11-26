'use client';

import type { FC } from 'react';
import { trackProviderClick } from '@/lib/analytics/providers';

export type Provider = {
  id: string;
  name: string;
  country?: string;
  score?: number;
  trend?: 'up' | 'down' | 'flat';
  tags?: string[];
  url?: string;
};

type Props = {
  provider: Provider;
  /** Optional rank the grid may pass in */
  rank?: number;
  onCopyUrl?: (id: string) => void;
  onOpen?: (id: string) => void;
};

export const ProviderCard: FC<Props> = ({ provider, rank, onCopyUrl, onOpen }) => {
  return (
    <article
      role="listitem"
      aria-label={`${provider.name} provider`}
      className="rounded-2xl border border-gray-200/60 bg-white/...ion-shadow focus-within:ring-2 focus-within:ring-indigo-500 p-4"
      data-testid={`provider-card-${provider.id}`}
    >
      <header className="flex items-center gap-2 mb-2">
        {typeof rank === 'number' && (
          <span
            aria-label={`rank ${rank}`}
            className="text-xs font-semibold w-6 h-6 grid place-items-center rounded-full bg-gray-100"
          >
            {rank}
          </span>
        )}
        <h3 className="text-base font-semibold">{provider.name}</h3>
        {provider.trend && (
          <span
            className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100"
            aria-label={`trend ${provider.trend}`}
          >
            {provider.trend === 'up' ? '?' : provider.trend === 'down' ? '?' : '?'}
          </span>
        )}
      </header>

      <div className="text-sm text-gray-700">
        {typeof provider.score === 'number' && (
          <p aria-label="score" className="font-medium tabular-nums">
            Score: {provider.score}
          </p>
        )}
        {provider.tags?.length ? (
          <p className="mt-1 text-gray-600">{provider.tags.map((t) => `#${t}`).join(' ')}</p>
        ) : (
          <p className="mt-1 text-gray-400" aria-live="polite">
            No tags yet
          </p>
        )}
      </div>

      <footer className="mt-3 flex gap-2">
        <button
          type="button"
          data-testid={`provider-open-${provider.id}`}
          className="rounded-xl px-3 py-1 text-sm border border-...outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          onClick={() => {
            trackProviderClick({
              providerId: provider.id,
              providerName: provider.name,
              source: 'grid',
            });
            onOpen?.(provider.id);
          }}
          aria-label={`Open ${provider.name} website`}
        >
          Open
        </button>
        <button
          type="button"
          data-testid={`provider-copy-${provider.id}`}
          className="rounded-xl px-3 py-1 text-sm border border-...outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          onClick={() => onCopyUrl?.(provider.id)}
          aria-label={`Copy ${provider.name} URL`}
        >
          Copy URL
        </button>
      </footer>
    </article>
  );
};

export default ProviderCard;
