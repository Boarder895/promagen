// frontend/src/components/providers/provider-card.tsx
"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { PROVIDER_STYLE_LABEL } from "@/lib/ui/provider-styles";
import { getProviderEmoji, getTrendEmoji } from "@/data/emoji";
import type { Provider } from "@/types/providers";

type Props = { provider: Provider & { rank?: number; emoji?: string; category?: string }; index?: number };

export default function ProviderCard({ provider, index }: Props) {
  const rank = provider.rank ?? (index !== undefined ? index + 1 : undefined);

  // Prefer JSON-provided styleLabel; otherwise the derived map.
  const styleLabel = (provider as any).styleLabel ?? PROVIDER_STYLE_LABEL[provider.id];

  // Single-source emoji resolution
  const providerEmoji = getProviderEmoji(provider);
  const trendEmoji = getTrendEmoji(provider.trend);

  const providerHref = `/providers/${provider.id}`;
  const visitHref = provider.affiliateUrl ?? provider.url;

  return (
    <div className="group relative flex flex-col justify-between rounded-2xl border border-zinc-900/40 bg-zinc-900/40 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition hover:border-zinc-700/60">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          {rank !== undefined && (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-zinc-800 text-zinc-300">
              {rank}
            </span>
          )}
          <span className="font-medium text-zinc-100">
            {providerEmoji ? `${providerEmoji} ` : ""}
            {provider.name}
          </span>
          {trendEmoji && <span className="text-xs text-zinc-400">{trendEmoji}</span>}
        </div>
        <div className="text-xs text-zinc-400">{styleLabel}</div>
      </div>

      {provider.tagline && (
        <div className="mt-2 line-clamp-2 text-sm text-zinc-300">
          {provider.tagline}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={providerHref}
          className="rounded-full bg-white/10 px-3 py-1 text-sm text-white ring-1 ring-white/10 hover:bg-white/15"
        >
          Details
        </Link>
        <Link
          href={visitHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/90 px-3 py-1 text-sm text-white hover:bg-emerald-500"
        >
          <ExternalLink className="h-3 w-3" />
          Visit
        </Link>
      </div>
    </div>
  );
}


