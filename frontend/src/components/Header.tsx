// src/components/Header.tsx � uses Next/Image and keeps Status/Health
import Link from "next/link";
import Image from "next/image";
import StatusChip from "@/components/StatusChip";
import ServiceBanner from "@/components/ServiceBanner";
import HealthDot from "@/components/health/HealthDot";

export default function Header() {
  return (
    <>
      <header className="w-full border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="Promagen" width={24} height={24} priority />
            <span className="font-semibold">Promagen</span>
          </Link>

          {/* Nav */}
          <nav className="hidden items-center gap-5 sm:flex">
            <Link href="/leaderboard" className="text-sm text-gray-600 hover:text-gray-900">Leaderboard</Link>
            <Link href="/prompts" className="text-sm text-gray-600 hover:text-gray-900">Prompts</Link>
            <Link href="/providers" className="text-sm text-gray-600 hover:text-gray-900">Providers</Link>
            <Link href="/status" className="rounded-full border px-3 py-1 text-xs text-gray-700 hover:bg-gray-50">Status</Link>
          </nav>

          {/* Right-side indicators */}
          <div className="flex items-center gap-4">
            <StatusChip />
            <HealthDot label="API" />
          </div>
        </div>
      </header>

      {/* Only shows when degraded/down */}
      <ServiceBanner />
    </>
  );
}


