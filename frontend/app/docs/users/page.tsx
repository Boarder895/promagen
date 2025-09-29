import Link from "next/link";
import * as Books from "@/lib/books";

// Find a "users" export regardless of naming
const usersLike: any =
  (Books as any).users ??
  (Books as any).usersBook ??
  (Books as any).Users ??
  (Books as any).UsersBook ??
  (Books as any).default ??
  { sections: [] };

type Section = { id?: string; title?: string; videoUrl?: string; tags?: string[] };

// Type guards
function hasVideoUrl(s: unknown): s is Section & { videoUrl: string } {
  return !!s && typeof (s as any).videoUrl === "string" && (s as any).videoUrl.length > 0;
}

export default function UsersDocsPage() {
  const sections: Section[] = Array.isArray(usersLike.sections) ? usersLike.sections : [];
  const tutorials = sections.filter(hasVideoUrl).slice(0, 8);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Users’ Book — Promagen</h1>
        <p className="opacity-80">Guides, how-tos, and fast starts.</p>
        <nav className="flex gap-4">
          <Link className="underline" href="/docs">Back to Docs</Link>
          <Link className="underline" href="/docs/developers">Developers’ Book</Link>
          <Link className="underline" href="/docs/history">History Book</Link>
        </nav>
      </header>

      {tutorials.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Quick Tutorials</h2>
          <ul className="list-disc pl-6 space-y-1">
            {tutorials.map((t, i) => (
              <li key={(t.id ?? t.title ?? i).toString()}>
                <a className="underline" href={t.videoUrl!} target="_blank" rel="noreferrer">
                  {t.title ?? "Tutorial"}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
