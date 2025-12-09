// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\tests\stale-badges.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { FxQuote } from '@/types/finance-ribbon';
import { FxFreshnessBadge } from '@/components/ribbon/fx-freshness-badge';

function makeQuote(minutesAgo: number): FxQuote {
  const now = Date.now();
  const asOf = new Date(now - minutesAgo * 60_000).toISOString();

  return {
    base: 'GBP',
    quote: 'USD',
    pairId: 'gbp-usd',
    mid: 1.2345,
    bid: 1.2345,
    ask: 1.2345,
    changeAbs: 0,
    changePct: 0,
    asOf,
    asOfUtc: asOf,
    provider: 'exchange-rate-api',
    providerSymbol: 'XRATE',
  };
}

describe('FxFreshnessBadge', () => {
  test('shows Fresh for very recent quotes when showWhenFresh is true', () => {
    const quote = makeQuote(5);

    render(<FxFreshnessBadge quote={quote} showWhenFresh />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Fresh');
  });

  test('shows Delayed for moderately old quotes', () => {
    const quote = makeQuote(30);

    render(<FxFreshnessBadge quote={quote} />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Delayed');
  });

  test('shows Stale for very old quotes', () => {
    const quote = makeQuote(120);

    render(<FxFreshnessBadge quote={quote} />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Stale');
  });

  test('can optionally show "Fresh" when requested', () => {
    const freshQuote = makeQuote(15); // 15 minutes ago

    render(<FxFreshnessBadge quote={freshQuote} showWhenFresh />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Fresh');
  });
});
