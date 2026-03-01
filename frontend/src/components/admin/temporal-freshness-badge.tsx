'use client';

// src/components/admin/temporal-freshness-badge.tsx
// ============================================================================
// TEMPORAL FRESHNESS BADGE — Admin health indicator for Phase 7.8 data
// ============================================================================
//
// Fetches /api/learning/temporal-all and computes staleness factors for
// both seasonal boosts and trending terms. Displays a colour-coded badge:
//
//   🟢 Fresh  — "2h old, 97% strength"
//   🟡 Stale  — "52h old, 48% strength"
//   🔴 Dead   — "8d old, 0% strength"
//   ⚪ No data — cron hasn't run yet
//
// Uses the same half-life decay formula as temporal-lookup.ts to ensure
// admin sees exactly what the suggestion engine sees.
//
// @see docs/authority/prompt-builder-evolution-plan-v2.md § 7.8e
//
// Version: 1.0.0
// Created: 2026-02-28
//
// Existing features preserved: Yes (new component, no existing code changed).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';

// ============================================================================
// STALENESS COMPUTATION (mirrors temporal-lookup.ts exactly)
// ============================================================================

const TRENDING_HALFLIFE_HOURS = 24;
const SEASONAL_HALFLIFE_HOURS = 48;
const MAX_STALENESS_HOURS = 168; // 1 week safety ceiling

function computeStalenessFactor(
  generatedAt: string,
  halfLifeHours: number,
  now: Date = new Date(),
): number {
  const ageMs = now.getTime() - new Date(generatedAt).getTime();
  if (ageMs <= 0) return 1.0;
  const ageHours = ageMs / 3_600_000;
  if (ageHours >= MAX_STALENESS_HOURS) return 0;
  return Math.pow(2, -(ageHours / halfLifeHours));
}

function formatAge(generatedAt: string): string {
  const ageMs = Date.now() - new Date(generatedAt).getTime();
  if (ageMs <= 0) return 'just now';
  const hours = ageMs / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m old`;
  if (hours < 48) return `${Math.round(hours)}h old`;
  const days = Math.round(hours / 24);
  return `${days}d old`;
}

// ============================================================================
// TYPES
// ============================================================================

interface TemporalAllResponse {
  ok: boolean;
  boosts: { generatedAt: string } | null;
  trending: { generatedAt: string } | null;
  boostsUpdatedAt: string | null;
  trendingUpdatedAt: string | null;
}

type FreshnessStatus = 'fresh' | 'stale' | 'dead' | 'no-data' | 'error' | 'loading';

interface ChannelInfo {
  label: string;
  age: string;
  strength: number; // 0–100
  status: FreshnessStatus;
}

// ============================================================================
// STATUS CLASSIFICATION
// ============================================================================

function classifyStatus(strength: number): FreshnessStatus {
  if (strength >= 70) return 'fresh';
  if (strength > 0) return 'stale';
  return 'dead';
}

const STATUS_CONFIG: Record<FreshnessStatus, {
  dot: string;
  ring: string;
  bg: string;
  text: string;
  label: string;
}> = {
  fresh: {
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-500/30',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    label: 'Fresh',
  },
  stale: {
    dot: 'bg-amber-400',
    ring: 'ring-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    label: 'Stale',
  },
  dead: {
    dot: 'bg-red-400',
    ring: 'ring-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Dead',
  },
  'no-data': {
    dot: 'bg-white/20',
    ring: 'ring-white/10',
    bg: 'bg-white/5',
    text: 'text-white/40',
    label: 'No data',
  },
  error: {
    dot: 'bg-red-400',
    ring: 'ring-red-500/30',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    label: 'Error',
  },
  loading: {
    dot: 'bg-white/20 animate-pulse',
    ring: 'ring-white/10',
    bg: 'bg-white/5',
    text: 'text-white/30',
    label: 'Loading…',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function TemporalFreshnessBadge() {
  const [channels, setChannels] = useState<{
    seasonal: ChannelInfo;
    trending: ChannelInfo;
  } | null>(null);
  const [overallStatus, setOverallStatus] = useState<FreshnessStatus>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/learning/temporal-all');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as TemporalAllResponse;

      if (!json.ok) throw new Error('API returned ok: false');

      const now = new Date();

      // Seasonal channel
      let seasonal: ChannelInfo;
      if (json.boosts?.generatedAt) {
        const strength = Math.round(
          computeStalenessFactor(json.boosts.generatedAt, SEASONAL_HALFLIFE_HOURS, now) * 100,
        );
        seasonal = {
          label: 'Seasonal',
          age: formatAge(json.boosts.generatedAt),
          strength,
          status: classifyStatus(strength),
        };
      } else {
        seasonal = { label: 'Seasonal', age: '—', strength: 0, status: 'no-data' };
      }

      // Trending channel
      let trending: ChannelInfo;
      if (json.trending?.generatedAt) {
        const strength = Math.round(
          computeStalenessFactor(json.trending.generatedAt, TRENDING_HALFLIFE_HOURS, now) * 100,
        );
        trending = {
          label: 'Trending',
          age: formatAge(json.trending.generatedAt),
          strength,
          status: classifyStatus(strength),
        };
      } else {
        trending = { label: 'Trending', age: '—', strength: 0, status: 'no-data' };
      }

      setChannels({ seasonal, trending });
      setErrorMsg(null);

      // Overall = worst of the two
      const statuses: FreshnessStatus[] = [seasonal.status, trending.status];
      if (statuses.includes('dead')) setOverallStatus('dead');
      else if (statuses.includes('no-data')) setOverallStatus('no-data');
      else if (statuses.includes('stale')) setOverallStatus('stale');
      else setOverallStatus('fresh');
    } catch (err) {
      setOverallStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes while the page is open
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const config = STATUS_CONFIG[overallStatus];

  return (
    <div
      className={`rounded-xl ring-1 ${config.ring} ${config.bg}`}
      style={{ padding: 'clamp(14px, 1.8vw, 20px)' }}
    >
      {/* Header row */}
      <div className="mb-3 flex items-center gap-2.5">
        <span style={{ fontSize: 'clamp(16px, 1.6vw, 22px)' }}>🕐</span>
        <h3
          className="font-semibold text-white/90"
          style={{ fontSize: 'clamp(13px, 1.3vw, 16px)' }}
        >
          Temporal Intelligence
        </h3>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${config.bg} ${config.text}`}
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>

      {/* Channel rows */}
      {channels ? (
        <div className="space-y-2">
          <ChannelRow info={channels.seasonal} halfLife="48h" />
          <ChannelRow info={channels.trending} halfLife="24h" />
        </div>
      ) : errorMsg ? (
        <p
          className="text-red-400/70"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          {errorMsg}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="h-5 animate-pulse rounded bg-white/5" />
          <div className="h-5 animate-pulse rounded bg-white/5" />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CHANNEL ROW
// ============================================================================

function ChannelRow({ info, halfLife }: { info: ChannelInfo; halfLife: string }) {
  const cfg = STATUS_CONFIG[info.status];

  return (
    <div className="flex items-center gap-2">
      {/* Status dot */}
      <span className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${cfg.dot}`} />

      {/* Label */}
      <span
        className="min-w-[60px] text-white/60"
        style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
      >
        {info.label}
      </span>

      {/* Strength bar */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${cfg.dot}`}
          style={{ width: `${info.strength}%` }}
        />
      </div>

      {/* Numbers */}
      <span
        className={`min-w-[88px] text-right font-mono ${cfg.text}`}
        style={{ fontSize: 'clamp(10px, 0.85vw, 11px)' }}
      >
        {info.status === 'no-data'
          ? 'no data'
          : `${info.age}, ${info.strength}%`}
      </span>

      {/* Half-life hint */}
      <span
        className="text-white/20"
        style={{ fontSize: 'clamp(9px, 0.8vw, 10px)' }}
        title={`Half-life: ${halfLife}`}
      >
        t½={halfLife}
      </span>
    </div>
  );
}
