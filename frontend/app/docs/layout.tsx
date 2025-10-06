import type { ReactNode } from "react";
import Link from "next/link";

const SHOW_DEV = process.env.NEXT_PUBLIC_SHOW_DEV_BOOK === "true";

type NavItem = { label: string; href: string };
type NavCardProps = { title: string; items: NavItem[] };

function NavCard({ title, items }: NavCardProps) {
  return (
    <aside className="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground">
        {title.toUpperCase()}
      </h2>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.href}>
            <Link className="underline-offset-2 hover:underline" href={it.href}>
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl gap-4 p-4 lg:grid lg:grid-cols-[240px_1fr_240px]">
      {/* Left nav: Developers (hidden unless env flag is true) */}
      <div className="space-y-4">
        {SHOW_DEV ? (
          <NavCard
            title="Developers Book"
            items={[
              { label: "Overview", href: "/docs/developers" },
              { label: "Shipped", href: "/docs/developers" },
              { label: "In progress", href: "/docs/developers" },
              { label: "To-Do (near-term)", href: "/docs/developers" },
              { label: "Medium-term", href: "/docs/developers" },
            ]}
          />
        ) : null}
      </div>

      {/* Main content */}
      <main className="rounded-2xl border bg-white p-4 shadow-sm">{children}</main>

      {/* Right nav: Users (always shown) */}
      <div className="space-y-4">
        <NavCard
          title="Users Book"
          items={[
            { label: "Overview", href: "/docs/users-book" },
            { label: "Getting started", href: "/docs/users-book" },
            { label: "FAQ", href: "/docs/users-book" },
          ]}
        />
      </div>
    </div>
  );
}
