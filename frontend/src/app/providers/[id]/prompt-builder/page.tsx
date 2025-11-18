// src/app/providers/[id]/prompt-builder/page.tsx

import React from 'react';
import type { Metadata } from 'next';

import { getProviders } from '@/lib/providers/api';
import PromptBuilder from '@/components/providers/prompt-builder';
import type { Provider } from '@/types/provider';

type Params = { id: string };

// ───────────────────────────────────────────────────────────────────────────────
// Dynamic per-provider metadata
// ───────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const providers = getProviders();
  const provider = providers.find((p) => p.id === params.id);

  if (!provider) {
    return {
      title: 'Prompt builder • Promagen',
      description:
        'Focused creative workspace for crafting image prompts for a single AI provider.',
      robots: { index: false, follow: false },
    };
  }

  const url = `https://promagen.example/providers/${provider.id}/prompt-builder`;
  const baseTitle = `Prompt builder — ${provider.name} • Promagen`;
  const description = `Craft image prompts for ${provider.name} inside Promagen's focused studio.`;

  return {
    title: baseTitle,
    description,
    openGraph: {
      title: baseTitle,
      description,
      url,
      type: 'website',
      siteName: 'Promagen',
    },
    twitter: {
      card: 'summary_large_image',
      title: baseTitle,
      description,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────────

export default function ProviderPromptBuilderPage({ params }: { params: Params }): JSX.Element {
  const providers = getProviders();
  const provider: Provider | undefined = providers.find((p) => p.id === params.id);

  const providerName = provider?.name ?? params.id;

  if (!provider) {
    return (
      <main role="main" aria-label={`Prompt builder for ${providerName}`} className="min-h-dvh">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p className="text-sm text-slate-700" aria-live="polite">
            The requested AI provider is not currently available in Promagen.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main role="main" aria-label={`Prompt builder for ${provider.name}`} className="min-h-dvh">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PromptBuilder provider={provider} />
      </div>
    </main>
  );
}
