import ProvidersTabList from "@/components/nav/tab-list";

export default function ProvidersTrendsPage() {
  return (
    <section className="space-y-6">
      <ProvidersTabList />
      <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h1 className="text-xl font-semibold">Trends</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Provider trends content goes here.
        </p>
      </div>
    </section>
  );
}

