import type { ReactNode } from "react";
import Link from "next/link";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      {/* 3-column grid with sticky sidebars */}
      <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 px-4 py-6 lg:gap-8 lg:px-8">
        {/* LEFT: Developers Book nav */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="sticky top-4">
            <nav className="rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Developers Book
              </h2>
              <ul className="space-y-2 text-sm">
                <li><Link href="/docs/developers-book" className="hover:underline">Overview</Link></li>
                <li><Link href="/docs/developers-book#shipped" className="hover:underline">Shipped</Link></li>
                <li><Link href="/docs/developers-book#in-progress" className="hover:underline">In progress</Link></li>
                <li><Link href="/docs/developers-book#todo" className="hover:underline">To-Do (near-term)</Link></li>
                <li><Link href="/docs/developers-book#medium-term" className="hover:underline">Medium-term</Link></li>
              </ul>
            </nav>
          </div>
        </aside>

        {/* CENTER: Active page (your markdown/tsx content renders here) */}
        <main className="col-span-12 lg:col-span-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mx-auto prose-doc">
              {children}
            </div>
          </div>
        </main>

        {/* RIGHT: Users/Progress nav */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="sticky top-4 space-y-6">
            <nav className="rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Users Book
              </h2>
              <ul className="space-y-2 text-sm">
                <li><Link href="/docs/users-book" className="hover:underline">Overview</Link></li>
                <li><Link href="/docs/users-book#getting-started" className="hover:underline">Getting started</Link></li>
                <li><Link href="/docs/users-book#faq" className="hover:underline">FAQ</Link></li>
              </ul>
            </nav>

            <nav className="rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-600">
                Build Progress Book
              </h2>
              <ul className="space-y-2 text-sm">
                <li><Link href="/docs/build-progress-book" className="hover:underline">Latest updates</Link></li>
                <li><Link href="/docs/build-progress-book#milestones" className="hover:underline">Milestones</Link></li>
              </ul>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}


