// frontend/src/components/providers/__tests__/providers-table.smoke.test.tsx

import React from 'react';
import { render, screen, within } from '@testing-library/react';
import ProvidersTable from '../providers-table';

/**
 * Smoke/contract tests for the AI Providers leaderboard table.
 *
 * Scope lock:
 * - Enforces the "Promagen Users" column contract + internal navigation + header order.
 * - Does NOT assert colours/spacing/typography (visual styling is locked elsewhere).
 *
 * Architecture note:
 * The table links to the internal provider detail/prompt builder page (/providers/{id}),
 * NOT directly to the external outbound route (/go/{id}). Outbound routing happens
 * from the LaunchPanel component on the provider detail page.
 */

type PromagenUsersCountryUsage = { countryCode: string; count: number };

type ProviderRow = React.ComponentProps<typeof ProvidersTable>['providers'][number];

// Analytics-derived field only (MUST NOT come from providers.json).
type TestProvider = ProviderRow & {
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
};

const baseProviders: ReadonlyArray<TestProvider> = [
  {
    id: 'openai',
    name: 'OpenAI DALL·E / GPT-Image',
    website: 'https://openai.com',
    affiliateUrl: null,
    requiresDisclosure: false,

    score: 92,
    trend: 'up',
    sweetSpot: 'Reliable all-rounder for clean, on-brief image generation.',
    visualStyles: 'Photoreal and product-style visuals; strong clarity and polish.',
    apiAvailable: true,
    affiliateProgramme: false,
    generationSpeed: 'fast',
    affordability: 'Paid; ££',

    promagenUsers: [
      { countryCode: 'DE', count: 1 }, // 🇩🇪 I
      { countryCode: 'GB', count: 2 }, // 🇬🇧 II
      { countryCode: 'US', count: 10 }, // 🇺🇸 X
    ],
  },
  {
    id: 'stability',
    name: 'Stability AI / Stable Diffusion',
    website: 'https://stability.ai',
    affiliateUrl: 'https://example.com/aff',
    requiresDisclosure: true,

    score: 86,
    trend: 'down',
    sweetSpot: 'Tinker-friendly powerhouse for custom workflows and control.',
    visualStyles: 'Huge range from photo to stylised; great for guided looks.',
    apiAvailable: true,
    affiliateProgramme: true,
    generationSpeed: 'varies',
    affordability: 'Free tier: limited; £',

    // Hard truth: zero users => render empty cell (no "0", no "—", no placeholders).
    promagenUsers: [],
  },
  {
    id: 'midjourney',
    name: 'Midjourney',
    website: 'https://www.midjourney.com',
    affiliateUrl: null,
    requiresDisclosure: false,

    score: 90,
    trend: 'flat',
    sweetSpot: 'Best-in-class aesthetics for striking concept imagery.',
    visualStyles: 'Cinematic, painterly, stylised "wow" images.',
    apiAvailable: false,
    affiliateProgramme: false,
    generationSpeed: 'medium',
    affordability: 'Paid; £££',

    // 8 countries => show top 6 + trailing "… +2"
    promagenUsers: [
      { countryCode: 'US', count: 10 },
      { countryCode: 'GB', count: 9 },
      { countryCode: 'DE', count: 8 },
      { countryCode: 'FR', count: 7 },
      { countryCode: 'ES', count: 6 },
      { countryCode: 'JP', count: 5 },
      { countryCode: 'IT', count: 4 },
      { countryCode: 'CA', count: 3 },
    ],
  },
];

function normaliseText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function mustGetTable(): HTMLTableElement {
  return screen.getByRole('table') as HTMLTableElement;
}

function mustGetColumnIndex(table: HTMLTableElement, headerText: string): number {
  const headers = within(table).getAllByRole('columnheader');
  const idx = headers.findIndex((h) => normaliseText(h.textContent) === headerText);
  if (idx < 0) throw new Error(`Could not find column header: "${headerText}"`);
  return idx;
}

function mustGetRowByProviderName(name: RegExp): HTMLTableRowElement {
  // Provider cell is an internal link to the prompt builder page.
  const el = screen.queryByRole('link', { name }) ?? screen.getByText(name);
  const row = el.closest('tr') as HTMLTableRowElement | null;
  if (!row) throw new Error(`Could not find table row for provider: ${String(name)}`);
  return row;
}

function mustGetCell(row: HTMLTableRowElement, headerText: string): HTMLElement {
  const table = mustGetTable();
  const colIndex = mustGetColumnIndex(table, headerText);

  // Include both <th> and <td> (some tables use scope="row" for first column).
  const cells = Array.from(row.querySelectorAll('th,td')) as HTMLElement[];
  const cell = cells[colIndex];

  if (!cell) {
    throw new Error(`Could not find cell for column "${headerText}" at index ${colIndex}`);
  }

  return cell;
}

/**
 * Verify that a link points to the internal provider detail page.
 * Contract: table links go to /providers/{id}, not external URLs.
 */
function expectProviderPageHref(link: HTMLElement, expectedProviderId: string): void {
  const href = link.getAttribute('href');
  expect(href).toBeTruthy();

  // Internal link to provider detail/prompt builder page
  expect(href).toBe(`/providers/${expectedProviderId}`);

  // Contract: UI must not link directly to external provider URLs.
  expect(String(href)).not.toMatch(/^https?:\/\//i);
}

describe('ProvidersTable (smoke)', () => {
  beforeEach(() => {
    // Keep test isolation (sid may be stored client-side in localStorage).
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it('renders the exact header contract (column order)', () => {
    render(<ProvidersTable providers={baseProviders} />);

    const table = mustGetTable();
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => normaliseText(h.textContent));

    expect(headers).toEqual([
      'Provider',
      'Promagen Users',
      'Sweet Spot',
      'Visual Styles',
      'API & Affiliate Programme',
      'Generation Speed',
      'Affordability',
      'Score',
    ]);

    // Contract: no separate Trend/Tags columns.
    expect(screen.queryByText('Trend')).toBeNull();
    expect(screen.queryByText('Tags')).toBeNull();
  });

  it('routes provider links to internal prompt builder page (no direct external URLs in the UI)', () => {
    render(<ProvidersTable providers={baseProviders} />);

    // Table links go to the internal provider detail/prompt builder page.
    // Outbound routing to external sites happens from the LaunchPanel on that page.
    const openaiLink = screen.getByRole('link', { name: /OpenAI DALL·E/i });
    expectProviderPageHref(openaiLink, 'openai');

    const stabilityLink = screen.getByRole('link', { name: /Stability AI/i });
    expectProviderPageHref(stabilityLink, 'stability');

    const mjLink = screen.getByRole('link', { name: /Midjourney/i });
    expectProviderPageHref(mjLink, 'midjourney');
  });

  it('renders Promagen Users as flags + Roman numerals, with underlying Arabic numbers available via aria-label', () => {
    render(<ProvidersTable providers={baseProviders} />);

    const providerRow = mustGetRowByProviderName(/OpenAI DALL·E/i);
    const usersCell = mustGetCell(providerRow, 'Promagen Users');

    // Roman numerals (display-only).
    expect(within(usersCell).getByText('I')).toBeInTheDocument();
    expect(within(usersCell).getByText('II')).toBeInTheDocument();
    expect(within(usersCell).getByText('X')).toBeInTheDocument();

    // Underlying Arabic number available via aria-label (usability + accessibility).
    expect(within(usersCell).getByLabelText('DE: 1 user')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('GB: 2 users')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('US: 10 users')).toBeInTheDocument();

    // Exactly 3 country blocks for this row.
    const blocks = within(usersCell).queryAllByLabelText(/^[A-Z]{2}: \d+ user/);
    expect(blocks).toHaveLength(3);

    // No truncation indicator when <= 6 countries.
    expect(within(usersCell).queryByText(/… \+\d+/)).toBeNull();
  });

  it('renders an empty Promagen Users cell when there are zero users (no 0, no dashes, no placeholders)', () => {
    render(<ProvidersTable providers={baseProviders} />);

    const providerRow = mustGetRowByProviderName(/Stability AI/i);
    const usersCell = mustGetCell(providerRow, 'Promagen Users');

    // Zero users => empty cell (no Roman numerals, no truncation).
    expect(within(usersCell).queryByLabelText(/^[A-Z]{2}: \d+ user/)).toBeNull();
    expect(within(usersCell).queryByText(/… \+\d+/)).toBeNull();
    expect(normaliseText(usersCell.textContent)).toBe('');
  });

  it('shows only the top 6 countries, then adds a trailing "… +n" when more exist', () => {
    render(<ProvidersTable providers={baseProviders} />);

    const providerRow = mustGetRowByProviderName(/Midjourney/i);
    const usersCell = mustGetCell(providerRow, 'Promagen Users');

    // 8 total -> show 6 + "… +2"
    expect(within(usersCell).getByText(/… \+2/)).toBeInTheDocument();

    // The two "extra" countries must not be rendered as country blocks.
    expect(within(usersCell).queryByLabelText('IT: 4 users')).toBeNull();
    expect(within(usersCell).queryByLabelText('CA: 3 users')).toBeNull();

    // Top 6 should still be present.
    expect(within(usersCell).getByLabelText('US: 10 users')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('GB: 9 users')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('DE: 8 users')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('FR: 7 users')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('ES: 6 users')).toBeInTheDocument();
    expect(within(usersCell).getByLabelText('JP: 5 users')).toBeInTheDocument();
  });
});
