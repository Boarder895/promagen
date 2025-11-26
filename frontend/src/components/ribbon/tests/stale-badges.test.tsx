// C:\Users\Proma\Projects\promagen\frontend\src\components\ribbon\tests\stale-badges.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { FxQuote } from '@/types/finance-ribbon';
import { FxFreshnessBadge } from '@/components/ribbon/fx-freshness-badge';

function makeQuote(minutesAgo: number): FxQuote {
  const now = Date.now();
  const asOf = new Date(now - minutesAgo * 60_000).toISOString();

  return {
    pairId: 'gbp-usd',
    mid: 1.2345,
    asOf,
    provider: 'exchange-rate-api',
  };
}

describe('FX freshness badges', () => {
  test('does not render a badge for a missing quote', () => {
    render(<FxFreshnessBadge quote={undefined} />);

    expect(screen.queryByTestId('fx-freshness-badge')).toBeNull();
  });

  test('does not render a badge for a fresh quote by default', () => {
    const freshQuote = makeQuote(30); // 30 minutes ago

    render(<FxFreshnessBadge quote={freshQuote} />);

    expect(screen.queryByTestId('fx-freshness-badge')).toBeNull();
  });

  test('renders "Ageing" for a quote between 60 and 90 minutes old', () => {
    const ageingQuote = makeQuote(75); // 75 minutes ago

    render(<FxFreshnessBadge quote={ageingQuote} />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Ageing');
  });

  test('renders "Delayed" for a quote more than 90 minutes old', () => {
    const delayedQuote = makeQuote(95); // 95 minutes ago

    render(<FxFreshnessBadge quote={delayedQuote} />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Delayed');
  });

  test('can optionally show "Fresh" when requested', () => {
    const freshQuote = makeQuote(15); // 15 minutes ago

    render(<FxFreshnessBadge quote={freshQuote} showWhenFresh />);

    const badge = screen.getByTestId('fx-freshness-badge');
    expect(badge).toHaveTextContent('Fresh');
  });
});
