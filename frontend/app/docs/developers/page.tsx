// app/docs/developers/page.tsx
import { getBook } from "@/lib/books";

export default function DevelopersPage() {
  const book = getBook("developers");
  const heading = book.meta?.title ?? book.title;
  const sub = book.meta?.subtitle;

  return (
    <main className="px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
        {sub ? <p className="text-sm opacity-70">{sub}</p> : null}
      </header>

      <p className="opacity-70">
        Engineering rules of the road for Promagen. Edit{" "}
        <code>src/lib/books.ts</code>. Frontend is the provider source of truth
        until launch.
      </p>

      <section className="space-y-4">
        {book.sections.map((s) => (
          <article key={s.id} className="rounded-xl border p-4">
            <h2 className="text-lg font-medium">{s.title}</h2>
            <p className="opacity-80">{s.summary}</p>
            <div className="text-xs opacity-60 mt-2">
              Status: {s.status}
              {s.lastUpdated ? ` � Updated: ${s.lastUpdated}` : null}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}


