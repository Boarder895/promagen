// frontend/src/app/providers/[id]/prompt-builder/page.tsx

import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PromptBuilder, { type PromptBuilderProvider } from '@/components/providers/prompt-builder';
import { getProviderById } from '@/data/providers';
import type { Provider } from '@/types/providers';

interface PageParams {
  params: {
    id: string;
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Metadata
// ───────────────────────────────────────────────────────────────────────────────

export function generateMetadata({ params }: PageParams): Metadata {
  const provider = getProviderById(params.id);

  const baseTitle = 'Prompt builder · Promagen';
  const title = provider ? `Prompt builder · ${provider.name} · Promagen` : baseTitle;

  const description =
    provider?.tagline ??
    'Prompt builder studio for Promagen – craft prompts for AI image providers with live market context.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      title,
      description,
      card: 'summary',
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Mapping helpers
// ───────────────────────────────────────────────────────────────────────────────

function toPromptBuilderProvider(provider: Provider): PromptBuilderProvider {
  return {
    id: provider.id,
    name: provider.name,
    // Prefer the canonical url field; PromptBuilder also accepts websiteUrl.
    websiteUrl: provider.url ?? undefined,
    url: provider.url ?? undefined,
    description: provider.tagline,
    tags: provider.tags,
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────────

export default function PromptBuilderPage({ params }: PageParams) {
  const provider = getProviderById(params.id);

  if (!provider) {
    notFound();
  }

  const builderProvider = toPromptBuilderProvider(provider);

  return (
    <main aria-label={`Prompt builder for ${builderProvider.name}`} className="flex flex-col gap-6">
      <PromptBuilder provider={builderProvider} />
    </main>
  );
}
