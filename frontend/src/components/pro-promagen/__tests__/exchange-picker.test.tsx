// src/components/pro-promagen/__tests__/exchange-picker.test.tsx
// ============================================================================
// EXCHANGE PICKER TESTS (v3.0.0 — Index-Per-Row)
// ============================================================================
// Smoke tests and edge case coverage per code-standard.md §12.
//
// v3.0.0 (16 Mar 2026):
// - ExchangeOption now represents ONE index per exchange
// - Compound selection keys: "exchangeId::benchmark"
// - Multi-index exchanges produce multiple test entries
// - Removed IndexSelector tests (no longer exists)
//
// Tests:
// - Renders without crashing
// - Handles empty exchanges array
// - Handles null/undefined props defensively
// - Selection toggle works
// - Selection limits enforced
// - Search filtering works
// - Continent grouping works
// ============================================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExchangePicker, type ExchangeOption } from '../exchange-picker';

// ============================================================================
// TEST DATA — Each entry is one index (compound key as id)
// ============================================================================

const mockExchanges: ExchangeOption[] = [
  // --- ASIA ---
  {
    id: 'tse-tokyo::jp225',
    exchangeId: 'tse-tokyo',
    label: 'TSE',
    fullName: 'Tokyo Stock Exchange (TSE)',
    benchmark: 'jp225',
    indexName: 'Nikkei 225',
    city: 'Tokyo',
    country: 'Japan',
    iso2: 'JP',
    continent: 'ASIA',
  },
  {
    id: 'tse-tokyo::jpvix',
    exchangeId: 'tse-tokyo',
    label: 'TSE',
    fullName: 'Tokyo Stock Exchange (TSE)',
    benchmark: 'jpvix',
    indexName: 'Japan VIX',
    city: 'Tokyo',
    country: 'Japan',
    iso2: 'JP',
    continent: 'ASIA',
  },
  {
    id: 'hkex-hong-kong::hk50',
    exchangeId: 'hkex-hong-kong',
    label: 'HKEX',
    fullName: 'Hong Kong Exchanges & Clearing (HKEX)',
    benchmark: 'hk50',
    indexName: 'Hang Seng',
    city: 'Hong Kong',
    country: 'China',
    iso2: 'HK',
    continent: 'ASIA',
  },
  // --- OCEANIA ---
  {
    id: 'asx-sydney::asx200',
    exchangeId: 'asx-sydney',
    label: 'ASX',
    fullName: 'Australian Securities Exchange (ASX)',
    benchmark: 'asx200',
    indexName: 'ASX 200',
    city: 'Sydney',
    country: 'Australia',
    iso2: 'AU',
    continent: 'OCEANIA',
  },
  // --- EUROPE ---
  {
    id: 'lse-london::gb100',
    exchangeId: 'lse-london',
    label: 'LSE',
    fullName: 'London Stock Exchange (LSE)',
    benchmark: 'gb100',
    indexName: 'FTSE 100',
    city: 'London',
    country: 'United Kingdom',
    iso2: 'GB',
    continent: 'EUROPE',
  },
  {
    id: 'lse-london::stoxx600',
    exchangeId: 'lse-london',
    label: 'LSE',
    fullName: 'London Stock Exchange (LSE)',
    benchmark: 'stoxx600',
    indexName: 'STOXX Europe 600',
    city: 'London',
    country: 'United Kingdom',
    iso2: 'GB',
    continent: 'EUROPE',
  },
  // --- NORTH AMERICA ---
  {
    id: 'nyse-new-york::us500',
    exchangeId: 'nyse-new-york',
    label: 'NYSE',
    fullName: 'New York Stock Exchange (NYSE)',
    benchmark: 'us500',
    indexName: 'S&P 500',
    city: 'New York',
    country: 'United States',
    iso2: 'US',
    continent: 'NORTH_AMERICA',
  },
  {
    id: 'nyse-new-york::us30',
    exchangeId: 'nyse-new-york',
    label: 'NYSE',
    fullName: 'New York Stock Exchange (NYSE)',
    benchmark: 'us30',
    indexName: 'Dow Jones 30',
    city: 'New York',
    country: 'United States',
    iso2: 'US',
    continent: 'NORTH_AMERICA',
  },
  // --- SOUTH AMERICA ---
  {
    id: 'b3-sao-paulo::ibovespa',
    exchangeId: 'b3-sao-paulo',
    label: 'B3',
    fullName: 'B3 — Brasil Bolsa Balcão',
    benchmark: 'ibovespa',
    indexName: 'IBOVESPA',
    city: 'São Paulo',
    country: 'Brazil',
    iso2: 'BR',
    continent: 'SOUTH_AMERICA',
  },
  // --- AFRICA ---
  {
    id: 'jse-johannesburg::jse',
    exchangeId: 'jse-johannesburg',
    label: 'JSE',
    fullName: 'Johannesburg Stock Exchange (JSE)',
    benchmark: 'jse',
    indexName: 'JSE All Share',
    city: 'Johannesburg',
    country: 'South Africa',
    iso2: 'ZA',
    continent: 'AFRICA',
  },
  // --- MIDDLE EAST ---
  {
    id: 'tadawul-riyadh::tasi',
    exchangeId: 'tadawul-riyadh',
    label: 'Tadawul',
    fullName: 'Saudi Exchange (Tadawul)',
    benchmark: 'tasi',
    indexName: 'TASI',
    city: 'Riyadh',
    country: 'Saudi Arabia',
    iso2: 'SA',
    continent: 'MIDDLE_EAST',
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Finds the toggle button (checkbox) for a given label + index text.
 *
 * The IndexListItem renders:
 *   <div class="flex w-full ...">        ← item row
 *     <button aria-pressed="...">        ← toggle (checkbox + flag)
 *     <div>                              ← label area (NOT inside button)
 *       <p>TSE — Nikkei 225</p>
 *       <p>Tokyo, Japan</p>
 *     </div>
 *   </div>
 *
 * So we find the label text, walk up to the row, and query the button.
 */
function findToggleButton(text: string): HTMLElement {
  const labelEl = screen.getByText((_content, element) => {
    return element?.tagName === 'P' && (element?.textContent?.includes(text) ?? false);
  });
  // Walk: <p> → <div.label-area> → <div.item-row>
  const itemRow = labelEl.parentElement?.parentElement;
  const btn = itemRow?.querySelector('button[aria-pressed]') as HTMLElement | null;
  if (!btn) throw new Error(`No toggle button found for "${text}"`);
  return btn;
}

/**
 * Expands a continent accordion by clicking its header button.
 */
function expandContinent(name: string): void {
  const btn = screen.getByRole('button', { name: new RegExp(name, 'i') });
  if (btn.getAttribute('aria-expanded') !== 'true') {
    fireEvent.click(btn);
  }
}

// ============================================================================
// SMOKE TESTS
// ============================================================================

describe('ExchangePicker', () => {
  describe('Smoke tests', () => {
    it('renders without crashing', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Selected Exchanges')).toBeInTheDocument();
    });

    it('renders with pre-selected compound keys', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo::jp225', 'lse-london::gb100']}
          onChange={onChange}
        />
      );
      expect(screen.getByText('2/16')).toBeInTheDocument();
    });

    it('displays continent headers', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Asia')).toBeInTheDocument();
      expect(screen.getByText('Oceania')).toBeInTheDocument();
      expect(screen.getByText('Europe')).toBeInTheDocument();
    });

    it('shows multi-index exchange as separate rows', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      // Expand Asia — TSE should have 2 rows
      expandContinent('Asia');

      // Both index names should be visible
      expect(screen.getByText(/Nikkei 225/)).toBeInTheDocument();
      expect(screen.getByText(/Japan VIX/)).toBeInTheDocument();
    });
  });

  // ============================================================================
  // DEFENSIVE GUARDS
  // ============================================================================

  describe('Defensive guards', () => {
    it('handles empty exchanges array', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={[]}
          selected={[]}
          onChange={onChange}
        />
      );
      expect(screen.getByText('Selected Exchanges')).toBeInTheDocument();
      expect(screen.getByText('0/16')).toBeInTheDocument();
    });

    it('handles null exchanges gracefully', () => {
      const onChange = jest.fn();
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <ExchangePicker
          exchanges={null as unknown as ExchangeOption[]}
          selected={[]}
          onChange={onChange}
        />
      );

      expect(screen.getByText('Selected Exchanges')).toBeInTheDocument();
      consoleWarn.mockRestore();
    });

    it('handles null selected gracefully', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={null as unknown as string[]}
          onChange={onChange}
        />
      );
      expect(screen.getByText('0/16')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // SEARCH
  // ============================================================================

  describe('Search', () => {
    it('filters exchanges by search query', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Search by exchange, city, country, or index...',
      );
      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });

      // Asia should still be visible (has Tokyo)
      expect(screen.getByText('Asia')).toBeInTheDocument();
    });

    it('searches by index name', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Search by exchange, city, country, or index...',
      );
      fireEvent.change(searchInput, { target: { value: 'Dow Jones' } });

      // North America should be visible (has NYSE Dow Jones)
      expect(screen.getByText('North America')).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Search by exchange, city, country, or index...',
      );
      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });

      fireEvent.click(screen.getByLabelText('Clear search'));

      expect(searchInput).toHaveValue('');
    });
  });

  // ============================================================================
  // DISABLED STATE
  // ============================================================================

  describe('Disabled state', () => {
    it('disables all interactions when disabled prop is true', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo::jp225']}
          onChange={onChange}
          disabled={true}
        />
      );

      const resetButton = screen.getByText('Reset');
      expect(resetButton).toBeDisabled();
    });

    it('disables search input when disabled', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
          disabled={true}
        />
      );

      const searchInput = screen.getByPlaceholderText(
        'Search by exchange, city, country, or index...',
      );
      expect(searchInput).toBeDisabled();
    });
  });

  // ============================================================================
  // ACCESSIBILITY
  // ============================================================================

  describe('Accessibility', () => {
    it('has accessible labels on interactive elements', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo::jp225']}
          onChange={onChange}
        />
      );

      expect(screen.getByLabelText('Search exchanges')).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove TSE Nikkei 225/i)).toBeInTheDocument();
    });

    it('has aria-expanded on accordion headers', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      const asiaButton = screen.getByRole('button', { name: /Asia/i });
      expect(asiaButton).toHaveAttribute('aria-expanded', 'false');

      const europeButton = screen.getByRole('button', { name: /Europe/i });
      expect(europeButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(asiaButton);
      expect(asiaButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('auto-expands continents that contain selected items', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo::jp225', 'lse-london::gb100']}
          onChange={onChange}
        />
      );

      const asiaButton = screen.getByRole('button', { name: /Asia/i });
      expect(asiaButton).toHaveAttribute('aria-expanded', 'true');

      const europeButton = screen.getByRole('button', { name: /Europe/i });
      expect(europeButton).toHaveAttribute('aria-expanded', 'true');

      const oceaniaButton = screen.getByRole('button', { name: /Oceania/i });
      expect(oceaniaButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('has aria-pressed on index items', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo::jp225']}
          onChange={onChange}
        />
      );

      expandContinent('Asia');

      const tseToggle = findToggleButton('Nikkei 225');
      expect(tseToggle).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Exchange picker helpers', () => {
  const {
    validateSelection,
    searchExchanges,
    groupByContinent,
    getExchangesByIds,
    makeCompoundKey,
    parseCompoundKey,
  } = require('@/lib/pro-promagen/exchange-picker-helpers');

  describe('makeCompoundKey / parseCompoundKey', () => {
    it('creates and parses compound keys', () => {
      const key = makeCompoundKey('cse-colombo', 'cse_all_share');
      expect(key).toBe('cse-colombo::cse_all_share');

      const parsed = parseCompoundKey(key);
      expect(parsed.exchangeId).toBe('cse-colombo');
      expect(parsed.benchmark).toBe('cse_all_share');
    });

    it('handles legacy simple keys', () => {
      const parsed = parseCompoundKey('lse-london');
      expect(parsed.exchangeId).toBe('lse-london');
      expect(parsed.benchmark).toBe('');
    });
  });

  describe('validateSelection', () => {
    it('returns valid for selection within limits', () => {
      const result = validateSelection(['a', 'b', 'c', 'd', 'e', 'f'], 6, 16);
      expect(result.valid).toBe(true);
    });

    it('returns invalid when below minimum', () => {
      const result = validateSelection(['a', 'b'], 6, 16);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('at least 6');
    });

    it('returns invalid when above maximum', () => {
      const result = validateSelection(new Array(20).fill('x'), 6, 16);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Maximum 16');
    });

    it('handles null input', () => {
      const result = validateSelection(null, 6, 16);
      expect(result.valid).toBe(false);
    });
  });

  describe('searchExchanges', () => {
    it('returns all when query is empty', () => {
      const result = searchExchanges(mockExchanges, '');
      expect(result.length).toBe(mockExchanges.length);
    });

    it('filters by label', () => {
      const result = searchExchanges(mockExchanges, 'HKEX');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('hkex-hong-kong::hk50');
    });

    it('filters by index name', () => {
      const result = searchExchanges(mockExchanges, 'Dow Jones');
      expect(result.length).toBe(1);
      expect(result[0].benchmark).toBe('us30');
    });

    it('filters by city', () => {
      const result = searchExchanges(mockExchanges, 'New York');
      expect(result.length).toBe(2); // NYSE S&P 500 + NYSE Dow Jones
    });

    it('filters by country', () => {
      const result = searchExchanges(mockExchanges, 'Japan');
      expect(result.length).toBe(2); // TSE Nikkei + TSE VIX
    });

    it('handles null input', () => {
      const result = searchExchanges(null, 'test');
      expect(result).toEqual([]);
    });
  });

  describe('groupByContinent', () => {
    it('groups options by continent', () => {
      const groups = groupByContinent(mockExchanges);
      expect(groups.get('ASIA')?.length).toBe(3); // TSE×2 + HKEX
      expect(groups.get('NORTH_AMERICA')?.length).toBe(2); // NYSE×2
      expect(groups.get('EUROPE')?.length).toBe(2); // LSE×2
    });

    it('returns empty groups for missing continents', () => {
      const groups = groupByContinent([mockExchanges[0]]);
      expect(groups.get('AFRICA')).toEqual([]);
    });

    it('handles null input', () => {
      const groups = groupByContinent(null);
      expect(groups.get('ASIA')).toEqual([]);
    });
  });

  describe('getExchangesByIds', () => {
    it('returns options matching compound IDs in order', () => {
      const result = getExchangesByIds(mockExchanges, ['lse-london::gb100', 'tse-tokyo::jp225']);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('lse-london::gb100');
      expect(result[1].id).toBe('tse-tokyo::jp225');
    });

    it('filters out non-existent IDs', () => {
      const result = getExchangesByIds(mockExchanges, ['tse-tokyo::jp225', 'fake::fake']);
      expect(result.length).toBe(1);
    });

    it('handles null input', () => {
      const result = getExchangesByIds(null, ['tse-tokyo::jp225']);
      expect(result).toEqual([]);
    });
  });
});
