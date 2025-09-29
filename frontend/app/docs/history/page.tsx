import { loadBooks } from "@/lib/books";

export default function HistoryDocsPage() {
  const { history } = loadBooks();

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{history.title}</h1>
      {history.sections.length === 0 ? (
        <p className="opacity-70">No history entries yet.</p>
      ) : (
        <ul className="list-disc pl-6 space-y-1">
          {history.sections.map((s, i) => (
            <li key={s.id ?? i}>{s.title ?? "Untitled entry"}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
