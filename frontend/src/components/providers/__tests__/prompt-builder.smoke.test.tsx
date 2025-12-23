import React from 'react';
import { render, screen } from '@testing-library/react';

import PromptBuilder from '../prompt-builder';
import type { Provider } from '@/types/provider';

const SAMPLE_PROVIDER: Provider = {
  id: 'midjourney',
  name: 'Midjourney',
  website: 'https://example.com/midjourney',
  url: 'https://example.com/midjourney',
  affiliateUrl: null,
  requiresDisclosure: false,
  score: 92,
  trend: 'up',
  tags: ['images'],
};

describe('PromptBuilder (smoke)', () => {
  it('renders the prompt editor and key controls', () => {
    render(<PromptBuilder provider={SAMPLE_PROVIDER} />);

    // Studio heading
    expect(
      screen.getByRole('heading', {
        name: /prompt builder/i,
      }),
    ).toBeInTheDocument();

    // Main textarea region
    expect(screen.getByLabelText(/image prompt/i)).toBeInTheDocument();

    // Core actions
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open in/i })).toBeInTheDocument();
  });
});
