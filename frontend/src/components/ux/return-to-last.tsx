"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { urlForProvider } from "@/lib/routes";

// where we store the last visited provider id in localStorage
const STORAGE_KEY = "last-provider-id";

export default function ReturnToLast() {
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    // Try storage first
    let found: string | null = null;
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw && typeof raw === "string" && raw.trim()) found = raw.trim();
    } catch {}

    // Fallback: if we are already on /providers/[id], capture it for the future
    if (!found && typeof window !== "undefined") {
      const m = window.location.pathname.match(/^\/providers\/([^/]+)\/?$/);
      if (m?.[1]) {
        found = decodeURIComponent(m[1]);
        try { window.localStorage.setItem(STORAGE_KEY, found); } catch {}
      }
    }
    setLastId(found);
  }, []);

  if (!lastId) return null;

  const href = urlForProvider(lastId);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link
        href={href}
        aria-label="Return to your last platform"
        className="group inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur
                   ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20
                   text-sm font-medium text-white shadow-[0_8px_30px_rgb(0,0,0,0.30)]
                   transition-transform duration-150 hover:scale-[1.03]"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 group-hover:scale-110 transition" />
        <span>Return to last platform</span>
      </Link>
    </div>
  );
}



