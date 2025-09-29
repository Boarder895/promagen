import Link from "next/link";
import * as Books from "@/lib/books";

// Narrow to objects that actually have videoUrl
function hasVideoUrl<T extends Record<string, unknown>>(s: T): s is T & { videoUrl: string } {
  return typeof (s as any).videoUrl === "string" && (s as any).videoUrl.length > 0;
}

// Tolerate different export names from books.ts
const usersLike: any =
  (Books as any).users ??
  (Books as any).usersBook ??
  (Books as any).Users ??
  (Books as any).UsersBook ??
  { sections: [] };

type Section = { id?: string; title?: string; videoUrl?: string; tags?: string[] };

export default function Page() {
  const sections: Section[] = Array.isArray(usersLike.sections) ? usersLike.sections : [];
  const tutorials = sections.filter(hasVideoUrl).slice(0, 8);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Promagen Books</h1>
        <p className="opacity-80">
          Users’ Book explains functionality; Developers’ Book tracks build progress; History Book logs changes.
        </p>
        <nav className="flex flex-wrap gap-3">
          <Link className="underline" href="/docs/users">Open Users’ Book</Link>
          <Link className="underline" href="/docs/developers">Open Developers’ Book</Link>
          <Link className="underline" href="/docs/history">Open History Book</Link>
        </nav>
      </header>

      {tutorials.length > 0 && (
        <section className="space-y-2">
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
