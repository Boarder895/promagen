// C:\Users\Proma\Projects\promagen\frontend\src\app\providers\leaderboard\page.tsx

import React from 'react';
import type { Metadata } from 'next';

import ProvidersTable from '@/components/providers/providers-table';
import { getProvidersWithPromagenUsers } from '@/lib/providers/api';

// Ensure the leaderboard can update after Cron runs (cheap + near-live).
// Promagen Users displays are guarded by freshness checks in the loader.
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'AI Providers Leaderboard • Promagen',
  description:
    'The Promagen AI providers leaderboard: sweet spots, visual styles, API/affiliate indicators, speed, affordability, and score.',
  robots: { index: true, follow: true },
};

export default async function ProvidersLeaderboardPage(): Promise<JSX.Element> {
  // No limit — shows all providers from SSOT (providers.json)
  const providers = await getProvidersWithPromagenUsers();

  return (
    <main role="main" className="p-6">
      <ProvidersTable
        providers={providers}
        title="AI Providers Leaderboard"
        caption="Score stays far right; other columns follow the display contract."
        showRank
      />
    </main>
  );
}
