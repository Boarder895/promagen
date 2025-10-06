// app/page.tsx
// Main homepage – MIG Top 20 & Global Exchanges
// Fully typed, App Router–compliant, and Next.js-safe

'use client';

import * as React from 'react';
import { DisclosureBanner } from '@/components/DisclosureBanner';
import { ProvidersBoard } from '@/components/ProvidersBoard';
import { ExchangeBoard } from '@/components/ExchangeBoard';
import { LiveDot } from '@/components/LiveDot';
import { SoundPill } from '@/components/SoundPill';
import { HomeBoardsWrapper } from '@/components/HomeBoardsWrapper';

export const dynamic = 'force-dynamic';

function Page(): JSX.Element {
  return (
    <main className="mx-auto max-w-[1200px] p-3 md:p-4 lg:p-5" style={{ minHeight: 640 }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-lg md:text-xl font-bold tracking-tight">
          Promagen — MIG Top 20 & Global Exchanges <LiveDot />
        </h1>
        <SoundPill />
      </div>

      <div className="mb-3">
        <DisclosureBanner />
      </div>

      {/* Shared cursor context so both boards’ sparklines sync */}
      <HomeBoardsWrapper>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section aria-labelledby="providers-heading">
            <h2 id="providers-heading" className="sr-only">
              Top 20 AI Image Platforms
            </h2>
            <ProvidersBoard />
          </section>

          <section aria-labelledby="exchanges-heading">
            <h2 id="exchanges-heading" className="sr-only">
              Global Stock Exchanges
            </h2>
            <ExchangeBoard />
          </section>
        </div>
      </HomeBoardsWrapper>
    </main>
  );
}

// ✅ Explicit default export — satisfies Next.js App Router typing
export default Page;

