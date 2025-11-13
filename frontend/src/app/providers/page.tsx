import React from "react";
import { getProviders } from "@/lib/providers/api";
import ProvidersTable from "@/components/providers/providers-table";

export const metadata = {
  title: "AI Providers Leaderboard • Promagen",
  description:
    "The Promagen leaderboard of AI providers with scores, trends, and tags.",
  robots: { index: true, follow: true },
};

export default function ProvidersLeaderboardPage(): JSX.Element {
  const providers = getProviders();

  return (
    <main role="main" className="p-6">
      <ProvidersTable
        providers={providers}
        title="AI Providers Leaderboard"
        caption="Top providers ranked by Promagen score."
        limit={20}
        showRank
      />
    </main>
  );
}
