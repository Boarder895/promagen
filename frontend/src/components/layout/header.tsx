"use client";

import Link from "next/link";

// Keep the header lean and independent of app context for now.
// If you want a live status indicator later, we can wire it to real health data.
// UPDATED: Studio link now points to /studio (was /prompts).

export default function Header() {
  return (
    <header className="sticky top-0 z-10 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 p-3">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Promagen
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/providers" className="opacity-80 hover:opacity-100">
            Providers
          </Link>
          <Link href="/studio" className="opacity-80 hover:opacity-100">
            Studio
          </Link>

          {/* Static green dot for now */}
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">API</span>
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </div>
        </nav>
      </div>
    </header>
  );
}
