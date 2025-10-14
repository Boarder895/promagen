'use client';

import Link from 'next/link';
import HealthDot from '@/components/health/HealthDot';

// Keep the header lean and independent of Context to avoid type churn.
// If you want it live-wired later, import useHealth() and pass its status.

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
          <Link href="/prompts" className="opacity-80 hover:opacity-100">
            Prompts
          </Link>

          {/* Static green dot; swap to your context if desired: <HealthDot status={status}/> */}
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">API</span>
            <HealthDot status="ok" />
          </div>
        </nav>
      </div>
    </header>
  );
}



