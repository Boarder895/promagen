import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Promagen',
  description: 'Leaderboard + prompts for AI image platforms.',
};

// NOTE: Default export ONLY. No named export `Page`, no `config`.
export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Promagen</h1>
      <p className="text-sm text-muted-foreground">
        Homepage scaffolding â€” ready for the live leaderboard section.
      </p>
    </main>
  );
}

