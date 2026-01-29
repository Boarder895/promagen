// src/components/pro-promagen/__tests__/exchange-picker.test.tsx
// ============================================================================
// EXCHANGE PICKER TESTS
// ============================================================================
// Smoke tests and edge case coverage per code-standard.md §12.
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
// TEST DATA
// ============================================================================

const mockExchanges: ExchangeOption[] = [
  { id: 'tse-tokyo', label: 'TSE Tokyo', city: 'Tokyo', country: 'Japan', iso2: 'JP', continent: 'ASIA' },
  { id: 'hkex-hong-kong', label: 'HKEX Hong Kong', city: 'Hong Kong', country: 'China', iso2: 'HK', continent: 'ASIA' },
  { id: 'asx-sydney', label: 'ASX Sydney', city: 'Sydney', country: 'Australia', iso2: 'AU', continent: 'OCEANIA' },
  { id: 'lse-london', label: 'LSE London', city: 'London', country: 'United Kingdom', iso2: 'GB', continent: 'EUROPE' },
  { id: 'nyse-new-york', label: 'NYSE New York', city: 'New York', country: 'United States', iso2: 'US', continent: 'NORTH_AMERICA' },
  { id: 'nasdaq-new-york', label: 'NASDAQ New York', city: 'New York', country: 'United States', iso2: 'US', continent: 'NORTH_AMERICA' },
  { id: 'b3-sao-paulo', label: 'B3 São Paulo', city: 'São Paulo', country: 'Brazil', iso2: 'BR', continent: 'SOUTH_AMERICA' },
  { id: 'jse-johannesburg', label: 'JSE Johannesburg', city: 'Johannesburg', country: 'South Africa', iso2: 'ZA', continent: 'AFRICA' },
  { id: 'tadawul-riyadh', label: 'Tadawul Riyadh', city: 'Riyadh', country: 'Saudi Arabia', iso2: 'SA', continent: 'MIDDLE_EAST' },
];

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
      expect(screen.getByText('Your Selection')).toBeInTheDocument();
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
      expect(screen.getByText('Your Selection')).toBeInTheDocument();
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
      
      expect(screen.getByText('Your Selection')).toBeInTheDocument();
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
      
      expect(screen.getByText('Your Selection')).toBeInTheDocument();
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
      fireEvent.click(screen.getByText('Asia'));
      
      // Click on TSE Tokyo
      fireEvent.click(screen.getByText('TSE Tokyo'));
      
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
      fireEvent.click(screen.getByText('Asia'));
      
      // Click on TSE Tokyo to deselect
      fireEvent.click(screen.getByText('TSE Tokyo'));
      
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
      fireEvent.click(screen.getByText('Europe'));
      
      // LSE should be disabled (not selected, but at max)
      const lseButton = screen.getByText('LSE London').closest('button');
      expect(lseButton).toBeDisabled();
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

      const searchInput = screen.getByPlaceholderText('Search by exchange, city, or country...');
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

      const searchInput = screen.getByPlaceholderText('Search by exchange, city, or country...');
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

      // Try to click reset
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

      const searchInput = screen.getByPlaceholderText('Search by exchange, city, or country...');
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

      const asiaButton = screen.getByRole('button', { name: /Asia/i });
      expect(asiaButton).toHaveAttribute('aria-expanded', 'true');
      
      const europeButton = screen.getByRole('button', { name: /Europe/i });
      expect(europeButton).toHaveAttribute('aria-expanded', 'false');
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
      fireEvent.click(screen.getByText('Asia'));
      
      const tseButton = screen.getByText('TSE Tokyo').closest('button');
      expect(tseButton).toHaveAttribute('aria-pressed', 'true');
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
      const result = searchExchanges(mockExchanges, 'TSE');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('tse-tokyo');
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
