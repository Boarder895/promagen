import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getProviderById, PROVIDERS } from '@/data/providers';

type ProviderDetailPageModule = typeof import('@/app/providers/[id]/page');
type PromptBuilderPageModule = typeof import('@/app/providers/[id]/prompt-builder/page');

let ProviderDetailPage: ProviderDetailPageModule['default'];
let ProviderPromptBuilderPage: PromptBuilderPageModule['default'];

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTestProvider() {
  const preferred = getProviderById('openai');
  const fallback = PROVIDERS[0];

  const provider = preferred ?? fallback;
  if (!provider) {
    throw new Error('No providers found in catalogue (PROVIDERS is empty).');
  }

  return provider;
}

beforeAll(async () => {
  ({ default: ProviderDetailPage } = await import('@/app/providers/[id]/page'));
  ({ default: ProviderPromptBuilderPage } = await import(
    '@/app/providers/[id]/prompt-builder/page'
  ));
});

describe('providers routes – render', () => {
  it('renders provider detail page for a provider id', async () => {
    const provider = getTestProvider();

    const ui = await ProviderDetailPage({ params: { id: provider.id } });
    render(ui);

    // The layout includes a sr-only H1 that contains the provider name, so we match the exact provider name
    // (this avoids the "Found multiple elements" failure).
    const exactName = new RegExp(`^${escapeRegExp(provider.name)}$`, 'i');
    expect(screen.getByRole('heading', { level: 1, name: exactName })).toBeInTheDocument();
  });

  it('renders prompt builder page for a provider id', () => {
    const provider = getTestProvider();

    render(<ProviderPromptBuilderPage params={{ id: provider.id }} />);

    const regionName = new RegExp(`Prompt builder for\\s+${escapeRegExp(provider.name)}`, 'i');
    expect(screen.getByRole('region', { name: regionName })).toBeInTheDocument();
  });
});
