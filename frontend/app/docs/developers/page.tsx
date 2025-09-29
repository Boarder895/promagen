import { loadBooks } from "@/lib/books";

export default function DevelopersDocsPage() {
  const { developers } = loadBooks();

  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">{developers.title}</h1>
      {developers.sections.length === 0 ? (
        <p className="opacity-70">No developer docs yet.</p>
      ) : (
        <ul className="list-disc pl-6 space-y-1">
          {developers.sections.map((s, i) => (
            <li key={s.id ?? i}>{s.title ?? "Untitled section"}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
