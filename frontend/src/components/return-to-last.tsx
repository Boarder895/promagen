"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Routes } from '@/lib/routes';

const LAST_KEYS = ["pm:last_provider", "last_provider", "lastid"] as const;

export default function ReturnToLast() {
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    // Walk a few legacy keys so older sessions still work.
    for (const k of LAST_KEYS) {
      try {
        const raw =
          typeof window !== "undefined" ? window.localStorage.getItem(k) : null;
        const v = (raw ?? "").trim();
        if (v) {
          setLastId(v);
          break;
        }
      } catch {
        // ignore storage errors (privacy mode, etc.)
      }
    }
  }, []);

  if (!lastId) {return null;}

  // Accepts an id and optional sub-section; see lib/routes.
  const href = Routes.provider(lastId);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link
        href={href}
        aria-label="Return to your last provider"
        className="group inline-flex items-center gap-2 rounded-full border border-zinc-700/60 bg-zinc-900/70 px-4 py-2
                   text-sm text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.25)]
                   backdrop-blur hover:border-zinc-600 hover:bg-zinc-900/90"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 group-hover:scale-110 transition" />
        <span>Return to last provider</span>
      </Link>
    </div>
  );
}

