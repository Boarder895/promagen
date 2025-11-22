// src/__tests__/routes.providers-ribbon.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';

// Import the actual route components.
// Relative paths so we don’t depend on any alias config here.
import ProviderDetailPage, {
  generateMetadata as generateProviderDetailMetadata,
} from '../app/providers/[id]/page';
import PromptBuilderPage, {
  generateMetadata as generatePromptBuilderMetadata,
} from '../app/providers/[id]/prompt-builder/page';

// ---------------------------------------------------------------------------
// Global matchMedia polyfill for jsdom.
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    // Minimal implementation that keeps components which rely on
    // prefers-reduced-motion / breakpoint queries happy in tests.
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated but still used in some code.
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }),
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAMPLE_ID = 'midjourney';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Providers routes – ribbon shells', () => {
  it('renders provider detail route without crashing (sanity check)', () => {
    render(<ProviderDetailPage params={{ id: SAMPLE_ID }} />);

    // Heading for the provider detail page should be present.
    // There are two level-1 headings containing "Midjourney":
    // - a screen-reader-only page title, and
    // - the visible card title in the centre column.
    // We assert that both are rendered, then sanity-check the visible one.
    const headings = screen.getAllByRole('heading', {
      name: /midjourney/i,
    });
    expect(headings).toHaveLength(2);
    expect(headings[1]).toHaveTextContent(/^Midjourney$/);
  });

  it('renders a studio layout without rails for /providers/[id]/prompt-builder', () => {
    render(<PromptBuilderPage params={{ id: SAMPLE_ID }} />);

    // Main region has an aria-label describing the studio for this provider.
    expect(
      screen.getByRole('main', {
        name: /prompt builder for midjourney/i,
      }),
    ).toBeInTheDocument();

    // Prompt editor region is present and labelled.
    // We deliberately use the region role here to avoid any ambiguity
    // between the <section aria-label="Prompt editor"> and the <textarea>.
    const editorRegion = screen.getByRole('region', {
      name: /prompt editor/i,
    });
    expect(editorRegion).toBeInTheDocument();

    // The actual textarea should be accessible via its label,
    // which is more specific: "Image prompt editor".
    const editorTextbox = screen.getByRole('textbox', {
      name: /image prompt editor/i,
    });
    expect(editorTextbox).toBeInTheDocument();

    // "Copy prompt" action should be available – core UX affordance.
    expect(
      screen.getByRole('button', {
        name: /copy prompt/i,
      }),
    ).toBeInTheDocument();

    // The prompt builder studio should *not* render the big finance ribbon rails
    // wrapping the whole page. That stays on the main providers detail page.
    // This acts as a guardrail: if someone accidentally wraps the studio in the
    // ribbon shell, this test will fail loudly.
    expect(screen.queryByLabelText(/finance ribbon/i)).not.toBeInTheDocument();
  });

  it('generateMetadata returns provider-specific titles for detail + prompt-builder', async () => {
    const detailMeta = await generateProviderDetailMetadata({
      params: { id: SAMPLE_ID },
    } as any);

    const builderMeta = await generatePromptBuilderMetadata({
      params: { id: SAMPLE_ID },
    } as any);

    // Both pages should surface the provider name in the title.
    // We keep the assertion intentionally flexible around the exact phrasing,
    // so you can tweak branding copy without breaking the suite.
    expect(detailMeta.title).toMatch(/midjourney/i);
    expect(builderMeta.title).toMatch(/midjourney/i);

    // And they should both clearly belong to Promagen.
    // Again, soft assertion on brand name – easy to refactor titles later.
    expect(detailMeta.title).toMatch(/promagen/i);
    expect(builderMeta.title).toMatch(/promagen/i);
  });
});
