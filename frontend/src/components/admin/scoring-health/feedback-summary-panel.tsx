'use client';

// src/components/admin/scoring-health/feedback-summary-panel.tsx
// ============================================================================
// SECTION 10 — FEEDBACK SUMMARY PANEL
// ============================================================================
//
// Displays:
//   - Overall Distribution: horizontal bars for 👍/👌/👎 with counts
//   - Per-Platform Satisfaction: top 5 + bottom 5, score %, event count
//   - Velocity: today / this week / all-time feedback counts
//   - Red Flags: platform-level alerts for low satisfaction or velocity drops
//   - Daily Sparkline: 30-day mini bar chart showing feedback volume
//
// Cross-Section Drill-Through (v2.0.0):
//   - Platforms with <50% satisfaction show "→ Anti-Patterns" button
//   - Red flags with platform context show "→ Anti-Patterns" button
//   Both smooth-scroll to Section 5 with platform filter applied.
//
// Data: GET /api/admin/scoring-health/feedback
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 8
//
// Version: 2.0.0 — cross-section drill-through links
// Created: 2026-03-01
//
// Existing features preserved: Yes (all v1.0.0 functionality intact).
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type {
  ScoringHealthApiResponse,
  FeedbackSummaryData,
  FeedbackDistribution,
  PlatformFeedback,
  DailyFeedback,
  FeedbackRedFlag,
} from '@/lib/admin/scoring-health-types';
import { useDrillThrough } from '@/lib/admin/drill-through-context';

// ============================================================================
// SENTIMENT BAR
// ============================================================================

function SentimentBar({ sentiment }: { sentiment: FeedbackDistribution }) {
  const total = sentiment.total || 1;
  const posPct = (sentiment.positive / total) * 100;
  const neuPct = (sentiment.neutral / total) * 100;
  const negPct = (sentiment.negative / total) * 100;

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
      {/* Bar rows */}
      {[
        { label: '👍 Great', count: sentiment.positive, pct: posPct, colour: 'bg-emerald-500', textColour: 'text-emerald-400' },
        { label: '👌 Okay', count: sentiment.neutral, pct: neuPct, colour: 'bg-amber-500', textColour: 'text-amber-400' },
        { label: '👎 Not good', count: sentiment.negative, pct: negPct, colour: 'bg-red-500', textColour: 'text-red-400' },
      ].map((row) => (
        <div
          key={row.label}
          className="flex items-center"
          style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}
        >
          <span
            className="flex-shrink-0 text-white/50"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', width: 'clamp(75px, 8vw, 100px)' }}
          >
            {row.label}
          </span>
          <div className="relative flex-1" style={{ height: 'clamp(14px, 1.5vw, 20px)' }}>
            <div className="absolute inset-0 rounded-full bg-white/5" />
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${row.colour}/30`}
              style={{ width: `${Math.max(row.pct, 1)}%`, transition: 'width 0.5s ease-out' }}
            />
          </div>
          <span
            className={`flex-shrink-0 font-mono ${row.textColour}`}
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', width: 'clamp(35px, 4vw, 50px)', textAlign: 'right' }}
          >
            {row.pct.toFixed(0)}%
          </span>
          <span
            className="flex-shrink-0 text-white/25"
            style={{ fontSize: 'clamp(9px, 0.8vw, 10px)', width: 'clamp(40px, 5vw, 60px)', textAlign: 'right' }}
          >
            ({row.count.toLocaleString()})
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PLATFORM TABLE — with drill-through links on low-scoring platforms
// ============================================================================

function PlatformTable({
  platforms,
  onDrillPlatform,
}: {
  platforms: PlatformFeedback[];
  onDrillPlatform?: (platform: string) => void;
}) {
  if (platforms.length === 0) {
    return (
      <p className="text-white/20" style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(6px, 0.6vw, 8px)' }}>
        No per-platform feedback data yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr clamp(50px, 6vw, 70px) clamp(55px, 6vw, 70px) auto',
          gap: 'clamp(4px, 0.5vw, 8px)',
          padding: 'clamp(4px, 0.5vw, 6px) clamp(6px, 0.6vw, 10px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span className="text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Platform</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>👍 Rate</span>
        <span className="text-right text-white/25" style={{ fontSize: 'clamp(8px, 0.7vw, 10px)' }}>Events</span>
        <span />
      </div>

      {/* Rows */}
      {platforms.map((p) => {
        const scoreColour = p.score >= 70
          ? 'text-emerald-400'
          : p.score >= 50
            ? 'text-amber-400'
            : 'text-red-400';

        const isLow = p.score < 50 && p.eventCount >= 3;

        return (
          <div
            key={p.platform}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr clamp(50px, 6vw, 70px) clamp(55px, 6vw, 70px) auto',
              gap: 'clamp(4px, 0.5vw, 8px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(6px, 0.6vw, 10px)',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
              alignItems: 'center',
            }}
            className="transition-colors hover:bg-white/[0.02]"
          >
            <span className="truncate text-white/60" style={{ fontSize: 'clamp(10px, 0.95vw, 13px)' }}>
              {p.platform}
            </span>
            <span className={`text-right font-mono ${scoreColour}`} style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}>
              {p.score.toFixed(0)}%
            </span>
            <span className="text-right font-mono text-white/30" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
              {p.eventCount.toLocaleString()}
            </span>
            <span>
              {isLow && onDrillPlatform && (
                <button
                  type="button"
                  onClick={() => onDrillPlatform(p.platform)}
                  className="rounded bg-violet-500/10 text-violet-400/60 transition-colors hover:bg-violet-500/20 hover:text-violet-400"
                  style={{
                    fontSize: 'clamp(8px, 0.7vw, 9px)',
                    padding: 'clamp(2px, 0.2vw, 3px) clamp(5px, 0.5vw, 7px)',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Investigate "${p.platform}" anti-patterns`}
                >
                  → Anti-Patterns
                </button>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// DAILY SPARKLINE
// ============================================================================

function DailySparkline({ days }: { days: DailyFeedback[] }) {
  if (days.length === 0) return null;

  const maxPerDay = Math.max(...days.map((d) => d.positive + d.neutral + d.negative), 1);

  return (
    <div className="flex items-end" style={{ height: 'clamp(32px, 4vw, 48px)', gap: '1px' }}>
      {days.map((d) => {
        const total = d.positive + d.neutral + d.negative;
        const heightPct = (total / maxPerDay) * 100;
        const posPct = total > 0 ? (d.positive / total) * 100 : 0;

        // Blend green to red based on positive ratio
        const barColour = posPct >= 70
          ? 'bg-emerald-500/40'
          : posPct >= 50
            ? 'bg-amber-500/40'
            : 'bg-red-500/40';

        return (
          <div
            key={d.date}
            className={`flex-1 rounded-t ${barColour}`}
            style={{
              height: `${Math.max(heightPct, 3)}%`,
              minWidth: '2px',
              transition: 'height 0.3s ease-out',
            }}
            title={`${d.date}: ${d.positive}👍 ${d.neutral}👌 ${d.negative}👎`}
          />
        );
      })}
    </div>
  );
}

// ============================================================================
// RED FLAGS — with drill-through on platform-specific flags
// ============================================================================

function RedFlags({
  flags,
  onDrillPlatform,
}: {
  flags: FeedbackRedFlag[];
  onDrillPlatform?: (platform: string) => void;
}) {
  if (flags.length === 0) return null;

  return (
    <div className="flex flex-col" style={{ gap: 'clamp(3px, 0.3vw, 5px)' }}>
      {flags.map((f, i) => (
        <div
          key={`${f.type}-${i}`}
          className={`flex items-center justify-between rounded-lg ${f.severity === 'critical' ? 'bg-red-500/10 ring-1 ring-red-500/20' : 'bg-amber-500/10 ring-1 ring-amber-500/20'}`}
          style={{
            padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
            fontSize: 'clamp(10px, 0.9vw, 12px)',
          }}
        >
          <div>
            <span className={f.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}>
              {f.severity === 'critical' ? '🔴' : '⚠️'}{' '}
            </span>
            <span className="text-white/50">{f.message}</span>
          </div>
          {f.platform && onDrillPlatform && (
            <button
              type="button"
              onClick={() => onDrillPlatform(f.platform!)}
              className="ml-2 flex-shrink-0 rounded bg-violet-500/10 text-violet-400/60 transition-colors hover:bg-violet-500/20 hover:text-violet-400"
              style={{
                fontSize: 'clamp(8px, 0.7vw, 9px)',
                padding: 'clamp(2px, 0.2vw, 3px) clamp(5px, 0.5vw, 7px)',
                whiteSpace: 'nowrap',
              }}
            >
              → Investigate
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FeedbackSummaryPanel() {
  const [data, setData] = useState<FeedbackSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { drillTo } = useDrillThrough();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/scoring-health/feedback');
      const json = (await res.json()) as ScoringHealthApiResponse<FeedbackSummaryData>;
      if (!json.ok || !json.data) {
        setError(json.message ?? 'Failed to load feedback data');
        setData(null);
      } else {
        setData(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => { void fetchData(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  /** Drill to Anti-Patterns filtered by platform */
  const handleDrillPlatform = useCallback((platform: string) => {
    drillTo('anti-patterns', { platform });
  }, [drillTo]);

  return (
    <div
      className="rounded-xl bg-white/5 ring-1 ring-white/10"
      style={{ padding: 'clamp(16px, 2vw, 24px)' }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2
            className="font-semibold text-white/80"
            style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
          >
            Feedback Summary
          </h2>
          <p
            className="text-white/30"
            style={{ fontSize: 'clamp(10px, 0.85vw, 12px)', marginTop: 'clamp(1px, 0.15vw, 2px)' }}
          >
            User feedback distribution, per-platform satisfaction, and volume
          </p>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 8px)' }}>
          {data && (
            <span className="text-white/25" style={{ fontSize: 'clamp(9px, 0.85vw, 11px)' }}>
              {data.sentiment.total.toLocaleString()} responses
            </span>
          )}
          <button
            type="button"
            onClick={fetchData}
            className="rounded-md bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/70"
            style={{ fontSize: 'clamp(10px, 0.9vw, 12px)', padding: 'clamp(4px, 0.4vw, 6px) clamp(10px, 1vw, 14px)' }}
          >
            ⟳
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
          <span className="animate-pulse text-white/30" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            Loading feedback data…
          </span>
        </div>
      )}

      {/* Error */}
      {error && !data && (
        <div className="flex items-center justify-center" style={{ minHeight: 'clamp(80px, 10vw, 120px)' }}>
          <span className="text-red-400/70" style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}>
            ❌ {error}
          </span>
        </div>
      )}

      {/* Data */}
      {data && (
        <div className="flex flex-col" style={{ gap: 'clamp(14px, 1.5vw, 20px)' }}>
          {/* Red Flags (top if present) — with drill-through */}
          <RedFlags flags={data.redFlags} onDrillPlatform={handleDrillPlatform} />

          {/* Velocity chips */}
          <div
            className="flex flex-wrap items-center"
            style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}
          >
            {[
              { label: 'Today', value: data.velocity.today, colour: 'text-emerald-400' },
              { label: 'This Week', value: data.velocity.thisWeek, colour: 'text-blue-400' },
              { label: 'All Time', value: data.velocity.allTime, colour: 'text-white/50' },
            ].map((v) => (
              <span
                key={v.label}
                className="rounded-lg bg-white/[0.03]"
                style={{
                  padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
                  fontSize: 'clamp(10px, 0.9vw, 12px)',
                }}
              >
                <span className="text-white/30">{v.label}: </span>
                <strong className={v.colour}>{v.value.toLocaleString()}</strong>
              </span>
            ))}
          </div>

          {/* Sentiment Distribution */}
          <div>
            <h3
              className="mb-2 font-semibold text-white/50"
              style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
            >
              Overall Distribution
            </h3>
            <SentimentBar sentiment={data.sentiment} />
          </div>

          {/* Daily Sparkline */}
          {data.dailySpark.length > 0 && (
            <div>
              <h3
                className="mb-2 font-semibold text-white/50"
                style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
              >
                Daily Volume (30 days)
              </h3>
              <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5" style={{ padding: 'clamp(6px, 0.6vw, 8px)' }}>
                <DailySparkline days={data.dailySpark} />
              </div>
            </div>
          )}

          {/* Per-Platform Satisfaction — with drill-through */}
          <div>
            <h3
              className="mb-2 font-semibold text-white/50"
              style={{ fontSize: 'clamp(11px, 1.1vw, 14px)' }}
            >
              Per-Platform Satisfaction
            </h3>
            <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5">
              <PlatformTable
                platforms={data.platformSatisfaction}
                onDrillPlatform={handleDrillPlatform}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
