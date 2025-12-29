// src/__tests__/routes.providers-ribbon.test.tsx
//
// Render tests for provider routes.
// Authority: docs/authority/prompt-builder-page.md
//
// Architecture note: The prompt-builder route (/providers/[id]/prompt-builder)
// is now a redirect to /providers/[id]. Render tests only cover the provider
// detail page which now includes the prompt builder workspace.

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { getProviderById, PROVIDERS } from '@/data/providers';

type ProviderDetailPageModule = typeof import('@/app/providers/[id]/page');

let ProviderDetailPage: ProviderDetailPageModule['default'];

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
});

describe('providers routes — render', () => {
  it('renders provider detail page with prompt builder region', () => {
    const provider = getTestProvider();

    render(<ProviderDetailPage params={{ id: provider.id }} />);

    // The provider detail page includes the prompt builder workspace.
    // HomepageGrid renders a main region with aria-label "Prompt builder for {name}".
    const regionName = new RegExp(`Prompt builder for\\s+${escapeRegExp(provider.name)}`, 'i');
    expect(screen.getByRole('main', { name: regionName })).toBeInTheDocument();
  });

  it('renders not-found state for unknown provider', () => {
    render(<ProviderDetailPage params={{ id: 'unknown-provider-xyz' }} />);

    // Should render the "Provider not found" section inside the main region.
    // The main region still has the label but with the raw id as fallback name.
    expect(screen.getByRole('region', { name: /provider not found/i })).toBeInTheDocument();
    expect(screen.getByText(/not in the current Promagen catalogue/i)).toBeInTheDocument();
  });
});
