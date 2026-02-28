// src/components/pro-promagen/__tests__/exchange-picker.test.tsx
// ============================================================================
// EXCHANGE PICKER TESTS (v2.1 — rewritten for current component)
// ============================================================================
// Smoke tests and edge case coverage per code-standard.md §12.
//
// Tests:
// - Renders without crashing
// - Handles empty exchanges array
// - Handles null/undefined props defensively
// - Selection toggle works (via checkbox button, not label text)
// - Selection limits enforced
// - Search filtering works
// - Continent grouping works
//
// NOTE: The ExchangeListItem renders the toggle <button> containing only
// the checkbox icon + flag. The exchange label is a sibling <div>, not
// inside the button. Use findToggleButton() helper to locate the correct
// interactive element for a given exchange label.
// ============================================================================

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExchangePicker, type ExchangeOption } from '../exchange-picker';

// ============================================================================
// TEST DATA
// ============================================================================

const mockExchanges: ExchangeOption[] = [
  {
    id: 'tse-tokyo',
    label: 'TSE Tokyo',
    city: 'Tokyo',
    country: 'Japan',
    iso2: 'JP',
    continent: 'ASIA',
    defaultBenchmark: 'jp225',
    defaultIndexName: 'Nikkei 225',
    availableIndices: [{ benchmark: 'jp225', indexName: 'Nikkei 225' }],
    hasMultipleIndices: false,
  },
  {
    id: 'hkex-hong-kong',
    label: 'HKEX Hong Kong',
    city: 'Hong Kong',
    country: 'China',
    iso2: 'HK',
    continent: 'ASIA',
    defaultBenchmark: 'hk50',
    defaultIndexName: 'Hang Seng',
    availableIndices: [{ benchmark: 'hk50', indexName: 'Hang Seng' }],
    hasMultipleIndices: false,
  },
  {
    id: 'asx-sydney',
    label: 'ASX Sydney',
    city: 'Sydney',
    country: 'Australia',
    iso2: 'AU',
    continent: 'OCEANIA',
    defaultBenchmark: 'asx200',
    defaultIndexName: 'ASX 200',
    availableIndices: [{ benchmark: 'asx200', indexName: 'ASX 200' }],
    hasMultipleIndices: false,
  },
  {
    id: 'lse-london',
    label: 'LSE London',
    city: 'London',
    country: 'United Kingdom',
    iso2: 'GB',
    continent: 'EUROPE',
    defaultBenchmark: 'gb100',
    defaultIndexName: 'FTSE 100',
    availableIndices: [{ benchmark: 'gb100', indexName: 'FTSE 100' }],
    hasMultipleIndices: false,
  },
  {
    id: 'nyse-new-york',
    label: 'NYSE New York',
    city: 'New York',
    country: 'United States',
    iso2: 'US',
    continent: 'NORTH_AMERICA',
    defaultBenchmark: 'us500',
    defaultIndexName: 'S&P 500',
    availableIndices: [
      { benchmark: 'us500', indexName: 'S&P 500' },
      { benchmark: 'us30', indexName: 'Dow Jones 30' },
    ],
    hasMultipleIndices: true,
  },
  {
    id: 'nasdaq-new-york',
    label: 'NASDAQ New York',
    city: 'New York',
    country: 'United States',
    iso2: 'US',
    continent: 'NORTH_AMERICA',
    defaultBenchmark: 'us100',
    defaultIndexName: 'NASDAQ 100',
    availableIndices: [{ benchmark: 'us100', indexName: 'NASDAQ 100' }],
    hasMultipleIndices: false,
  },
  {
    id: 'b3-sao-paulo',
    label: 'B3 São Paulo',
    city: 'São Paulo',
    country: 'Brazil',
    iso2: 'BR',
    continent: 'SOUTH_AMERICA',
    defaultBenchmark: 'ibovespa',
    defaultIndexName: 'IBOVESPA',
    availableIndices: [{ benchmark: 'ibovespa', indexName: 'IBOVESPA' }],
    hasMultipleIndices: false,
  },
  {
    id: 'jse-johannesburg',
    label: 'JSE Johannesburg',
    city: 'Johannesburg',
    country: 'South Africa',
    iso2: 'ZA',
    continent: 'AFRICA',
    defaultBenchmark: 'jse',
    defaultIndexName: 'JSE All Share',
    availableIndices: [{ benchmark: 'jse', indexName: 'JSE All Share' }],
    hasMultipleIndices: false,
  },
  {
    id: 'tadawul-riyadh',
    label: 'Tadawul Riyadh',
    city: 'Riyadh',
    country: 'Saudi Arabia',
    iso2: 'SA',
    continent: 'MIDDLE_EAST',
    defaultBenchmark: 'tasi',
    defaultIndexName: 'TASI',
    availableIndices: [{ benchmark: 'tasi', indexName: 'TASI' }],
    hasMultipleIndices: false,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Finds the toggle button (checkbox) for a given exchange label.
 *
 * The ExchangeListItem renders:
 *   <div class="flex w-full ...">        ← item row
 *     <button aria-pressed="...">        ← toggle (checkbox + flag)
 *     <div>                              ← label area (NOT inside button)
 *       <p>TSE Tokyo</p>
 *       <p>Tokyo, Japan</p>
 *     </div>
 *   </div>
 *
 * So we find the label text, walk up to the row, and query the button.
 */
function findToggleButton(label: string): HTMLElement {
  const labelEl = screen.getByText(label, { selector: 'p' });
  // Walk: <p> → <div.label-area> → <div.item-row>
  const itemRow = labelEl.parentElement?.parentElement;
  const btn = itemRow?.querySelector('button[aria-pressed]') as HTMLElement | null;
  if (!btn) throw new Error(`No toggle button found for "${label}"`);
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

    it('renders with pre-selected exchanges', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo', 'lse-london']}
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

    it('handles undefined selected gracefully', () => {
      const onChange = jest.fn();
      const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();

      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={undefined as unknown as string[]}
          onChange={onChange}
        />
      );

      expect(screen.getByText('0/16')).toBeInTheDocument();
      consoleWarn.mockRestore();
    });

    it('filters out invalid exchange entries', () => {
      const onChange = jest.fn();
      const invalidExchanges = [
        ...mockExchanges,
        null,
        undefined,
        { id: '', label: 'Invalid', city: '', country: '', iso2: 'XX', continent: 'EUROPE' as const },
      ] as ExchangeOption[];

      render(
        <ExchangePicker
          exchanges={invalidExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      expect(screen.getByText('Selected Exchanges')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // SELECTION BEHAVIOR
  // ============================================================================

  describe('Selection behavior', () => {
    it('calls onChange when selecting an exchange', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={[]}
          onChange={onChange}
        />
      );

      // Expand Asia continent
      expandContinent('Asia');

      // Click the checkbox button for TSE Tokyo
      fireEvent.click(findToggleButton('TSE Tokyo'));

      expect(onChange).toHaveBeenCalledWith(['tse-tokyo']);
    });

    it('calls onChange when deselecting an exchange', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo']}
          onChange={onChange}
        />
      );

      // Expand Asia continent
      expandContinent('Asia');

      // Click the checkbox button for TSE Tokyo to deselect
      fireEvent.click(findToggleButton('TSE Tokyo'));

      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('respects max selection limit', () => {
      const onChange = jest.fn();
      const selected = mockExchanges.slice(0, 3).map((ex) => ex.id);

      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={selected}
          onChange={onChange}
          max={3}
        />
      );

      // Expand Europe continent
      expandContinent('Europe');

      // LSE checkbox should be disabled (not selected, at max capacity)
      const lseToggle = findToggleButton('LSE London');
      expect(lseToggle).toBeDisabled();
    });

    it('shows minimum validation message when below min', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo']}
          onChange={onChange}
          min={6}
        />
      );

      expect(screen.getByText('Select at least 6 exchanges')).toBeInTheDocument();
    });

    it('resets selection when reset button clicked', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo', 'lse-london']}
          onChange={onChange}
        />
      );

      fireEvent.click(screen.getByText('Reset'));

      expect(onChange).toHaveBeenCalledWith([]);
    });
  });

  // ============================================================================
  // SEARCH FUNCTIONALITY
  // ============================================================================

  describe('Search functionality', () => {
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
        'Search by exchange, city, country, or index...'
      );
      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });

      // Asia should still be visible (has Tokyo)
      expect(screen.getByText('Asia')).toBeInTheDocument();
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
        'Search by exchange, city, country, or index...'
      );
      fireEvent.change(searchInput, { target: { value: 'Tokyo' } });

      // Click clear button
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
          selected={['tse-tokyo']}
          onChange={onChange}
          disabled={true}
        />
      );

      // Reset button should be disabled
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
        'Search by exchange, city, country, or index...'
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
          selected={['tse-tokyo']}
          onChange={onChange}
        />
      );

      expect(screen.getByLabelText('Search exchanges')).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove TSE Tokyo/i)).toBeInTheDocument();
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

      // All continents start collapsed when nothing selected
      const asiaButton = screen.getByRole('button', { name: /Asia/i });
      expect(asiaButton).toHaveAttribute('aria-expanded', 'false');

      const europeButton = screen.getByRole('button', { name: /Europe/i });
      expect(europeButton).toHaveAttribute('aria-expanded', 'false');

      // Clicking expands
      fireEvent.click(asiaButton);
      expect(asiaButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('auto-expands continents that contain selected exchanges', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo', 'lse-london']}
          onChange={onChange}
        />
      );

      // Asia should be auto-expanded (contains tse-tokyo)
      const asiaButton = screen.getByRole('button', { name: /Asia/i });
      expect(asiaButton).toHaveAttribute('aria-expanded', 'true');

      // Europe should be auto-expanded (contains lse-london)
      const europeButton = screen.getByRole('button', { name: /Europe/i });
      expect(europeButton).toHaveAttribute('aria-expanded', 'true');

      // Oceania should remain collapsed (no selections)
      const oceaniaButton = screen.getByRole('button', { name: /Oceania/i });
      expect(oceaniaButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('has aria-pressed on exchange items', () => {
      const onChange = jest.fn();
      render(
        <ExchangePicker
          exchanges={mockExchanges}
          selected={['tse-tokyo']}
          onChange={onChange}
        />
      );

      // Expand Asia
      expandContinent('Asia');

      const tseToggle = findToggleButton('TSE Tokyo');
      expect(tseToggle).toHaveAttribute('aria-pressed', 'true');
    });
  });
});

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('Exchange picker helpers', () => {
  // Import helpers directly for unit testing
  const {
    validateSelection,
    searchExchanges,
    groupByContinent,
    getExchangesByIds,
  } = require('@/lib/pro-promagen/exchange-picker-helpers');

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
      // Note: "TSE" matches both "TSE Tokyo" and "FTSE 100" index name.
      // Use a unique label substring for a single-match test.
      const result = searchExchanges(mockExchanges, 'HKEX');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('hkex-hong-kong');
    });

    it('filters by city', () => {
      const result = searchExchanges(mockExchanges, 'New York');
      expect(result.length).toBe(2);
    });

    it('filters by country', () => {
      const result = searchExchanges(mockExchanges, 'Japan');
      expect(result.length).toBe(1);
    });

    it('handles null input', () => {
      const result = searchExchanges(null, 'test');
      expect(result).toEqual([]);
    });
  });

  describe('groupByContinent', () => {
    it('groups exchanges by continent', () => {
      const groups = groupByContinent(mockExchanges);
      expect(groups.get('ASIA')?.length).toBe(2);
      expect(groups.get('NORTH_AMERICA')?.length).toBe(2);
      expect(groups.get('EUROPE')?.length).toBe(1);
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
    it('returns exchanges matching IDs in order', () => {
      const result = getExchangesByIds(mockExchanges, ['lse-london', 'tse-tokyo']);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('lse-london');
      expect(result[1].id).toBe('tse-tokyo');
    });

    it('filters out non-existent IDs', () => {
      const result = getExchangesByIds(mockExchanges, ['tse-tokyo', 'fake-id']);
      expect(result.length).toBe(1);
    });

    it('handles null input', () => {
      const result = getExchangesByIds(null, ['tse-tokyo']);
      expect(result).toEqual([]);
    });
  });
});
