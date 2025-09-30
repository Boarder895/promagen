// app/docs/history/page.tsx
import { getBook, metaOf } from "@/lib/books";

export default function HistoryPage() {
  const book = getBook("history");
  const meta = metaOf(book);
  const entries = Array.isArray(book.entries) ? book.entries : [];

  return (
    <main className="px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
        {meta.subtitle ? <p className="text-sm opacity-70">{meta.subtitle}</p> : null}
      </header>

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

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Timeline</h2>
        {entries.length === 0 ? (
          <p className="opacity-70">No entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg border p-3">
                <div className="text-sm">{e.text}</div>
                {e.date ? <div className="text-xs opacity-60 mt-1">{e.date}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

