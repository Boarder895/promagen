import type { Metadata } from 'next';
import { getProviderById, PROVIDERS } from '@/data/providers';
import { generateMetadata as generateProviderDetailMetadata } from '@/app/providers/[id]/page';
import { generateMetadata as generatePromptBuilderMetadata } from '@/app/providers/[id]/prompt-builder/page';

function getTestProvider() {
  const preferred = getProviderById('openai');
  const fallback = PROVIDERS[0];

  const provider = preferred ?? fallback;
  if (!provider) {
    throw new Error('No providers found in catalogue (PROVIDERS is empty).');
  }

  return provider;
}

function normaliseTitle(title: Metadata['title']): string | undefined {
  if (!title) return undefined;
  if (typeof title === 'string') return title;

  // Next allows objects like { absolute: string } and template shapes.
  if (typeof title === 'object' && 'absolute' in title && typeof title.absolute === 'string') {
    return title.absolute;
  }

  return undefined;
}

describe('providers routes – metadata', () => {
  it('generates provider detail metadata', async () => {
    const provider = getTestProvider();

    const metadata = await generateProviderDetailMetadata({ params: { id: provider.id } });
    const title = normaliseTitle(metadata.title);

    expect(title).toBe(`${provider.name} • Promagen AI provider`);
  });

  it('generates prompt builder metadata', async () => {
    const provider = getTestProvider();

    const metadata = await generatePromptBuilderMetadata({ params: { id: provider.id } });
    const title = normaliseTitle(metadata.title);

    expect(title).toBe(`Prompt builder · ${provider.name} · Promagen`);
  });
});
