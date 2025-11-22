import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import PromptBuilder from '@/components/providers/prompt-builder';
import providersCatalog from '@/data/providers/providers.json';
import type { Provider } from '@/types/provider';

interface PageParams {
  params: {
    id: string;
  };
}

const providers = providersCatalog as Provider[];

function findProvider(id: string): Provider | null {
  const provider = providers.find((entry) => entry.id === id);
  return provider ?? null;
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const provider = findProvider(params.id);

  if (!provider) {
    return {
      title: 'Prompt builder',
      description: 'Build and refine AI prompts.',
    };
  }

  return {
    title: `${provider.name} · Prompt builder · Promagen`,
    description: `Build and refine prompts to run on ${provider.name}.`,
  };
}

export default function PromptBuilderPage({ params }: PageParams) {
  const provider = findProvider(params.id);

  if (!provider) {
    notFound();
  }

  return (
    <main aria-label={`Prompt builder for ${provider!.name}`} className="flex flex-col gap-6">
      <PromptBuilder provider={provider!} />
    </main>
  );
}
