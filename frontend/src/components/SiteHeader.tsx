"use client";

import Link from "next/link";
import ApiStatusBadge from "@/components/ApiStatusBadge";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <nav className="flex items-center gap-4">
          <Link href="/" className="font-semibold hover:underline">
            Promagen
          </Link>
          <Link href="/status" className="text-sm hover:underline">
            Status
          </Link>
          <Link href="/admin" className="text-sm hover:underline">
            Admin
          </Link>
        </nav>

        {/* Live API health, compact form */}
        <div className="flex items-center gap-3">
          <ApiStatusBadge compact />
        </div>
      </div>
    </header>
  );
}
