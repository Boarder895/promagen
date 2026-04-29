// src/app/providers/trends/page.tsx
// ============================================================================
// PROVIDERS TRENDS REDIRECT (v10.4.0)
// ============================================================================
// Previously a placeholder stub ("Provider trends content goes here").
// Trend signals (rank movement, Index Rating deltas) live on the styled
// leaderboard at /providers/leaderboard.
// ============================================================================

import { redirect } from 'next/navigation';

export default function ProvidersTrendsRedirect(): never {
  redirect('/providers/leaderboard');
}
