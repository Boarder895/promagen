"use client";

import React from "react";
import { getBook } from "@/lib/books"; // named import

/** Developers Book � Quick View (uses sections) */
export default function BuildQuick() {
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
            <li
              key={s?.id ?? s?.title}
              className="rounded-2xl border border-zinc-200/60 p-4 shadow-sm hover:shadow transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium leading-6">
                    <a
                      href={`/docs/developers#${encodeURIComponent(s?.id ?? s?.title ?? "")}`}
                      className="hover:underline"
                    >
                      {s?.title ?? "Untitled"}
                    </a>
                  </div>
                  {s?.summary ? <p className="mt-1 text-sm opacity-80">{s.summary}</p> : null}
                </div>
                <div className="flex flex-col items-end text-right">
                  {s?.status ? (
                    <span className="rounded-full border px-2 py-0.5 text-xs opacity-80">{s.status}</span>
                  ) : null}
                  {s?.lastUpdated ? (
                    <span className="mt-1 text-[11px] opacity-60">Updated {s.lastUpdated}</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}





