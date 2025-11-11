// frontend/src/app/page.tsx
import dynamic from "next/dynamic";
import Link from "next/link";
import ProvidersTable from "@/components/providers/providers-table";

const Ribbon = dynamic(() => import("@/components/markets/exchange-ribbon"), { ssr: true });

export default function HomePage() {
  const asOf = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date());

  return (
    // NOTE: <main id="main"> is provided by layout.tsx
    <div className="min-h-screen py-8">
      <section className="px-6 md:px-10 lg:px-16">
        {/* Exactly one <h1> on the page */}
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Promagen — compare AI image generators and craft better prompts
        </h1>

        <p className="mt-3 max-w-3xl text-sm md:text-base text-neutral-300">
          A desktop-first dashboard: live market ribbon, a 20-provider leaderboard, and
          prompt tools. Built for calm reading and quick triage.
        </p>

        <p className="mt-2 text-xs text-neutral-400">
          As-of {asOf}. Some links may use <strong>Affiliate</strong> routing — we may earn a{" "}
          <strong>commission</strong>.
        </p>
      </section>

      {/* Finance ribbon placeholder */}
      <section aria-label="Finance ribbon" className="mt-6 px-6 md:px-10 lg:px-16">
        <Ribbon />
      </section>

      {/* Three-column grid */}
      <section
        aria-label="Homepage grid"
        className="mt-8 grid grid-cols-12 gap-6 px-6 md:px-10 lg:px-16"
      >
        {/* Left rail */}
        <div aria-label="Eastern exchanges" role="list" className="col-span-12 md:col-span-3 space-y-3">
          <div role="listitem" className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
          <div role="listitem" className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
          <div role="listitem" className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
        </div>

        {/* Center: providers */}
        <div className="col-span-12 md:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">AI providers</h2>
            <Link href="/providers" className="text-sm underline underline-offset-4">
              View all
            </Link>
          </div>
          <div className="mt-4">
            <ProvidersTable />
          </div>

          {/* Visible disclosure near the table (Playwright looks for this) */}
          <p className="mt-3 text-xs text-neutral-400">
            Disclosure: Some outgoing links may be <strong>Affiliate</strong> destinations — we may
            earn a <strong>commission</strong>. “As-of” labels indicate the last refresh time for
            scores and market tiles.
          </p>
        </div>

        {/* Right rail */}
        <div aria-label="Western exchanges" role="list" className="col-span-12 md:col-span-3 space-y-3">
          <div role="listitem" className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
          <div role="listitem" className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
          <div role="listitem" className="h-16 rounded-xl bg-white/5 ring-1 ring-white/10" />
        </div>
      </section>
    </div>
  );
}
