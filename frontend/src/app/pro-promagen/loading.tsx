// src/app/pro-promagen/loading.tsx
// ============================================================================
// PRO PROMAGEN LOADING SKELETON
// ============================================================================
// Loading state for the /pro-promagen route.
// Displays skeleton cards matching the page layout.
// Authority: docs/authority/code-standard.md
// ============================================================================

import React from 'react';

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

function SkeletonCard({ height = 'h-32' }: { height?: string }) {
  return (
    <div
      className={`${height} rounded-2xl bg-slate-900/50 ring-1 ring-white/5 animate-pulse`}
    />
  );
}

function SkeletonExchangeCard() {
  return (
    <div className="rounded-xl bg-slate-900/40 ring-1 ring-white/5 p-3 animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 space-y-1">
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="h-2 w-16 rounded bg-white/5" />
        </div>
        <div className="w-4 h-3 rounded bg-white/10" />
      </div>
      <div className="h-5 w-16 rounded bg-white/10 mt-2" />
    </div>
  );
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function ProPromagenLoading() {
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header skeleton */}
      <div className="h-14 border-b border-white/5 animate-pulse" />

      {/* Main content grid */}
      <div className="grid grid-cols-[280px_1fr_280px] gap-4 p-4 max-w-[1800px] mx-auto">
        {/* Left rail */}
        <aside className="space-y-2">
          <div className="h-3 w-20 rounded bg-white/5 mb-3" />
          {[...Array(6)].map((_, i) => (
            <SkeletonExchangeCard key={`left-${i}`} />
          ))}
        </aside>

        {/* Centre panel */}
        <main className="rounded-3xl bg-slate-950/70 ring-1 ring-white/10 p-4 space-y-4">
          {/* Header */}
          <div className="space-y-2 mb-4">
            <div className="h-5 w-40 rounded bg-white/10 animate-pulse" />
            <div className="h-3 w-64 rounded bg-white/5 animate-pulse" />
          </div>

          {/* Mode badge */}
          <div className="h-6 w-32 rounded-full bg-white/5 animate-pulse" />

          {/* Comparison table skeleton */}
          <SkeletonCard height="h-48" />

          {/* Selection panels */}
          <SkeletonCard height="h-24" />
          <SkeletonCard height="h-24" />

          {/* Coming soon */}
          <SkeletonCard height="h-20" />
          <SkeletonCard height="h-20" />

          {/* Perks */}
          <SkeletonCard height="h-32" />

          {/* CTA */}
          <SkeletonCard height="h-24" />
        </main>

        {/* Right rail */}
        <aside className="space-y-2">
          <div className="h-3 w-20 rounded bg-white/5 mb-3" />
          {[...Array(6)].map((_, i) => (
            <SkeletonExchangeCard key={`right-${i}`} />
          ))}
        </aside>
      </div>

      {/* Footer skeleton */}
      <div className="h-12 border-t border-white/5 mt-4 animate-pulse" />
    </div>
  );
}
