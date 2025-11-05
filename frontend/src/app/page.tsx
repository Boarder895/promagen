import dynamic from "next/dynamic";
import Link from "next/link";
import ProvidersTable from "@/components/providers/providers-table";

const Ribbon = dynamic(() => import("@/components/markets/exchange-ribbon"), { ssr: true });

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Hero / intro */}
      <section className="px-6 py-10 md:px-10 lg:px-16">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Promagen â€” compare AI image generators and craft better prompts
        </h1>
        <p className="mt-3 max-w-3xl text-sm md:text-base text-muted-foreground">
          A desktop-first dashboard: live market ribbon, a 20-provider leaderboard, and prompt tools.
          Some rankings are prototype values and will evolve with real usage data.
        </p>
      </section>

      {/* Live ribbon */}
      <section className="border-t">
        <Ribbon />
      </section>

      {/* Leaderboard */}
      <section className="px-4 md:px-8 lg:px-12 py-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-medium">Top AI Image Providers</h2>
          <Link href="/docs/users-book" className="text-sm underline underline-offset-4">
            Read the quick guide
          </Link>
        </div>
        <ProvidersTable />
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">Affiliate notice:</span> some provider links are affiliate links â€” we may earn a commission.
        </p>
      </section>
    </main>
  );
}






















