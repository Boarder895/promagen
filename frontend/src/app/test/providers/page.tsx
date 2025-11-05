import providers from "@/data/providers.json";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DEFAULT_Q =
  "A photorealistic macro shot of a dew-covered leaf at sunrise, ultra-detailed, bokeh";

export default function Page() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Test: Providers</h1>
        <p className="text-sm text-neutral-600">
          Quick links to all 20 /providers/[id] pages with a sample ?q= prompt.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-3">
        {providers.map((p) => {
          const href = `/providers/${p.id}?q=${encodeURIComponent(DEFAULT_Q)}`;
          return (
            <li key={p.id}>
              <Link
                className="block rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                href={href}
              >
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-xs text-neutral-500">({p.id})</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}



