// src/components/providers/__tests__/prompt-builder.analytics.test.tsx

import React from 'react';
import { render } from '@testing-library/react';

import PromptBuilder from '../prompt-builder';
import type { Provider } from '@/types/provider';
import { trackPromptBuilderOpen } from '@/lib/analytics/providers';

jest.mock('@/lib/analytics/providers', () => ({
  trackPromptBuilderOpen: jest.fn(),
}));

const SAMPLE_PROVIDER: Provider = {
  id: 'midjourney',
  name: 'Midjourney',
  score: 92,
  trend: 'up',
  tags: ['images'],
  url: 'https://example.com/midjourney',
};

describe('PromptBuilder analytics', () => {
  it('emits prompt_builder_open when mounted', () => {
    render(<PromptBuilder provider={SAMPLE_PROVIDER} />);

    expect(trackPromptBuilderOpen).toHaveBeenCalledTimes(1);
    expect(trackPromptBuilderOpen).toHaveBeenCalledWith({
      providerId: 'midjourney',
      location: 'providers_page',
    });
  });
});
