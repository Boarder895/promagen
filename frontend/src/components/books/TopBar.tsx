"use client";

import React from "react";
import Link from "next/link";
import { getBook } from "@/lib/books";

/**
 * TopBar � builds nav from the three books via getBook()
 * No Books/BookStore/BooksDataCompat anywhere.
 */
export default function TopBar() {
  const dev = getBook("developers") as any;
  const usr = getBook("users") as any;
  const hist = getBook("history") as any;

  const devSections = Array.isArray(dev?.sections) ? dev.sections : [];
  const usrSections = Array.isArray(usr?.sections) ? usr.sections : [];
  const histSections = Array.isArray(hist?.sections) ? hist.sections : [];

  const entries: Array<{ label: string; href: string }> = [
    ...usrSections.map((s: any, i: number) => ({
      label: `Users ${i + 1}. ${s?.title ?? "Untitled"}`,
      href: `/docs/users#${encodeURIComponent(s?.id ?? s?.title ?? String(i + 1))}`,
    })),
    ...devSections.map((s: any, i: number) => ({
      label: `Developers ${i + 1}. ${s?.title ?? "Untitled"}`,
      href: `/docs/developers#${encodeURIComponent(s?.id ?? s?.title ?? String(i + 1))}`,
    })),
    ...histSections.slice(0, 6).map((s: any, i: number) => ({
      label: `History ${i + 1}. ${s?.title ?? "Untitled"}`,
      href: `/docs/history#${encodeURIComponent(s?.id ?? s?.title ?? String(i + 1))}`,
    })),
  ];

  if (entries.length === 0) return null;

  return (
    <nav className="flex flex-wrap gap-2 text-sm opacity-90">
      {entries.map((e) => (
        <Link key={e.href} href={e.href} className="rounded-full border px-2 py-0.5 hover:underline">
          {e.label}
        </Link>
      ))}
    </nav>
  );
}



