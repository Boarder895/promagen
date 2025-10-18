"use client";

export type TocItem = { id: string; text: string; level?: number };

export function DocsTOC({ items = [] as TocItem[] }: { items?: TocItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Table of contents" className="text-sm">
      <ul className="space-y-1">
        {items.map((h) => (
          <li key={h.id} className={h.level && h.level > 2 ? "pl-4" : ""}>
            <a href={`#${h.id}`} className="hover:underline">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}














