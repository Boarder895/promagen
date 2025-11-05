import ProvidersTabList from "@/components/nav/tab-list";

export default function ProvidersPage() {
  return (
    <main className="space-y-6 p-8">
      {/* Header kept from your placeholder */}
      <div>
        <h1 className="text-2xl font-semibold">Providers</h1>
        <p className="opacity-70 text-sm">Placeholder for Stage 2.</p>
      </div>

      {/* Routed tabs row driven by src/data/tabs/providers.json */}
      <ProvidersTabList />

      {/* Page body for the default tab (Leader­board) */}
      <section className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-xl font-semibold">Leaderboard</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Your provider leaderboard content goes here.
        </p>
      </section>
    </main>
  );
}

