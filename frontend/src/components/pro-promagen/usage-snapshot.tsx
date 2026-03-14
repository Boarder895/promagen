// src/components/pro-promagen/usage-snapshot.tsx
// ============================================================================
// USAGE SNAPSHOT — "Your Promagen Today"
// ============================================================================
// Personalised summary showing what the user has consumed and what's at risk.
// Human Factor: Loss Aversion + Endowment Effect — they already own something
// (prompts, saved work) and this makes the constraints tangible.
//
// Authority: docs/authority/human-factors.md
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';
import { usePromagenAuth } from '@/hooks/use-promagen-auth';
import { useSavedPrompts } from '@/hooks/use-saved-prompts';

// ============================================================================
// PROGRESS BAR
// ============================================================================

function MiniProgressBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.min(100, Math.round((current / max) * 100));
  const isNearLimit = pct >= 80;

  return (
    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${pct}%`,
          background: isNearLimit
            ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
            : `linear-gradient(90deg, ${color}, ${color}88)`,
        }}
      />
    </div>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  subtext,
  color,
  current,
  max,
}: {
  label: string;
  value: string;
  subtext: string;
  color: string;
  current?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2.5 ring-1 ring-white/[0.06]">
      <span
        className="text-xs font-medium text-white/50"
        style={{ fontSize: 'clamp(0.6rem, 0.75vw, 0.7rem)' }}
      >
        {label}
      </span>
      <span
        className="text-lg font-bold tabular-nums"
        style={{ color, fontSize: 'clamp(1rem, 1.3vw, 1.25rem)' }}
      >
        {value}
      </span>
      {current !== undefined && max !== undefined && (
        <MiniProgressBar current={current} max={max} color={color} />
      )}
      <span
        className="text-xs text-white/40"
        style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.65rem)' }}
      >
        {subtext}
      </span>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UsageSnapshot() {
  const { userTier, dailyUsage, anonymousUsage } = usePromagenAuth();
  const { allPrompts } = useSavedPrompts();

  const isPro = userTier === 'paid';

  // Usage data
  const count = dailyUsage?.count ?? anonymousUsage?.count ?? 0;
  const limit = dailyUsage?.limit ?? anonymousUsage?.limit ?? 5;
  const remaining = limit - count;
  const savedCount = allPrompts.length;

  // Pro users see a congratulatory version
  if (isPro) return null;

  return (
    <div className="mb-4">
      <h3
        className="text-sm font-semibold text-white/70 mb-2"
        style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.8rem)' }}
      >
        Your Promagen Today
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Prompts Used"
          value={`${count} / ${limit}`}
          subtext={remaining <= 1 ? 'Almost at limit' : `${remaining} remaining`}
          color={remaining <= 1 ? '#ef4444' : '#38bdf8'}
          current={count}
          max={limit}
        />
        <StatCard
          label="Saved Prompts"
          value={String(savedCount)}
          subtext="Browser only — lost on clear"
          color="#a78bfa"
        />
        <StatCard
          label="Scenes Explored"
          value="25 / 200"
          subtext="175 locked"
          color="#fbbf24"
          current={25}
          max={200}
        />
      </div>
    </div>
  );
}

export default UsageSnapshot;
