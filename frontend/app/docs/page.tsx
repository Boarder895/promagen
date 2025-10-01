// app/docs/page.tsx
import { getBook, metaOf } from "@/lib/books";

export default function DocsHome() {
  const history = getBook("history");
  const meta = metaOf(history);

  return (
    <main className="px-6 py-8 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{meta.title}</h1>
      {meta.subtitle ? <p className="text-sm opacity-70">{meta.subtitle}</p> : null}
    </main>
  );
}





