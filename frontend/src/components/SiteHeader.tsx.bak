// FRONTEND • NEXT.JS
// File: frontend/components/SiteHeader.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export default function SiteHeader() {
  const pathname = usePathname();
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100",
        pathname === href && "bg-gray-100"
      )}
    >
      {label}
    </Link>
  );

  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-lg">
          Promagen
        </Link>
        <nav className="flex items-center gap-1">
          {link("/", "Home")}
          {link("/status", "Status")}
        </nav>
      </div>
    </header>
  );
}
