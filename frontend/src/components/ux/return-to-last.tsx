"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Routes } from "@/lib/routes";
import { KEYS, LEGACY_LAST_PROVIDER_KEYS } from "@/lib/storage.keys";
import { readSchema, writeSchema } from "@/lib/storage";

/**
 * Finds the last provider id (versioned first, then legacy fallbacks)
 * and renders a calm quick-return pill.
 */

const V = 1;

export default function ReturnToLast() {
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    // 1) Preferred: versioned key
    try {
      const v1 = readSchema<string | null>(KEYS.providers.lastV1, V, null);
      if (v1 && typeof v1 === "string") {
        setLastId(v1);
        return;
      }
    } catch {
      // ignore
    }

    // 2) Legacy fallbacks
    for (const k of LEGACY_LAST_PROVIDER_KEYS) {
      try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(k) : null;
        const v = (raw ?? "").trim();
        if (v) {
          setLastId(v);
          // Migrate forward quietly
          writeSchema<string | null>(KEYS.providers.lastV1, V, v);
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  if (!lastId) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40" data-testid="return-to-last">
      <Link
        href={Routes.provider(lastId)}
        title="Return to your last provider"
        aria-label="Return to your last provider"
        className="group inline-flex items-center gap-2 rounded-full border border-zinc-700/60
                   bg-zinc-900/70 px-4 py-2 text-sm text-zinc-200 shadow-[0_8px_30px_rgba(0,0,0,0.25)]
                   backdrop-blur hover:border-zinc-600 hover:bg-zinc-900/90"
        data-testid="return-to-last-link"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 transition group-hover:scale-110" aria-hidden />
        <span>Return to last provider</span>
      </Link>
    </div>
  );
}
