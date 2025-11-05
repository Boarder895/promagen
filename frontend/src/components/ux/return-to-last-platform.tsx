"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { urlForProvider } from "@/lib/routes";

/**
 * Canonical storage key going forward.
 * We also read a small set of legacy keys to be tolerant of past versions.
 */
const CANONICAL_KEY = "last-provider-id";
const LEGACY_KEYS = ["lastProvider", "last_platform", "lastPlatform", "lastid", CANONICAL_KEY];

/**
 * ReturnToLastPlatform
 * - Reads the last provider id from localStorage (legacy-safe).
 * - If the user is currently on /providers/[id], capture it and persist under CANONICAL_KEY.
 * - Renders a floating CTA that deep-links back to the last provider page.
 */
export default function ReturnToLastPlatform() {
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    // 1) Try to capture the current provider id from URL if we’re on /providers/[id]
    let detected: string | null = null;
    try {
      if (typeof window !== "undefined") {
        const m = window.location.pathname.match(/^\/providers\/([^/]+)\/?$/);
        if (m?.[1]) {
          detected = decodeURIComponent(m[1]);
          try {
            window.localStorage.setItem(CANONICAL_KEY, detected);
          } catch {
            /* ignore write errors */
          }
        }
      }
    } catch {
      /* ignore URL parsing errors */
    }

    // 2) If not detected from URL, try storage (legacy-safe)
    let found: string | null = detected;
    if (!found && typeof window !== "undefined") {
      for (const k of LEGACY_KEYS) {
        try {
          const v = window.localStorage.getItem(k);
          if (typeof v === "string" && v.trim().length > 0) {
            found = v.trim();
            break;
          }
        } catch {
          /* ignore read errors */
        }
      }
    }

    // 3) If we found an id under a legacy key, rewrite it to the canonical key for the future
    if (found && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CANONICAL_KEY, found);
      } catch {
        /* ignore write errors */
      }
    }

    setLastId(found ?? null);
  }, []);

  if (!lastId) return null;

  const href = urlForProvider(lastId);
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link
        href={href}
        aria-label="Return to your last platform"
        className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 text-sm font-medium text-white shadow-[0_8px_30px_rgb(0,0,0,0.30)] transition-transform duration-150 hover:scale-[1.03]"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 group-hover:scale-110 transition" />
        <span>Return to last platform</span>
      </Link>
    </div>
  );
}



