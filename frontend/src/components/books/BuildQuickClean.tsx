"use client";

import React from "react";
import { getBook } from "@/lib/books";

export default function BuildQuickClean() {
  const devBook: any = getBook("developers");
  const sections = Array.isArray(devBook?.sections) ? devBook.sections : [];

  return (
    <section className="mt-6 opacity-90">
      <h2 className="text-xl font-semibold tracking-tight">Developers Book � Quick View</h2>
      {sections.length === 0 ? (
        <p className="mt-2 text-sm opacity-70">
          Nothing to show yet. Add sections to <span className="font-mono">developersBook.sections</span>.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sections.map((s: any) => (
            <li key={s?.id ?? s?.title} className="rounded-2xl border border-zinc-200/60 p-4 shadow-sm">
              <div className="text-base font-medium leading-6">{s?.title ?? "Untitled"}</div>
              {s?.summary ? <p className="mt-1 text-sm opacity-80">{s.summary}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}


