import ProvidersTabList from "@/components/nav/tab-list";

export default function ProvidersComparePage() {
  return (
    <section className="space-y-6">
      <ProvidersTabList />
      <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h1 className="text-xl font-semibold">Compare</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Provider comparison content goes here.
        </p>
      </div>
    </section>
  );
}

