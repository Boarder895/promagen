import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test Â· Leaderboard",
  description: "Internal test page for leaderboard rendering.",
};

// Default export ONLY. No named export `Page`, no `config`.
export default function TestLeaderboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">Test Â· Leaderboard</h1>
      <p className="text-sm text-muted-foreground">
        Minimal scaffold â€“ hook the real leaderboard component here later.
      </p>
    </main>
  );
}

