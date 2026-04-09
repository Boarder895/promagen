'use client';

/**
 * Sentinel Dashboard Client Component
 *
 * Renders the last 12 weeks of Sentinel data as interactive cards
 * with health score trend, regression sparkline, and top actions.
 *
 * Design rules (code-standard.md):
 *   - Desktop-only, clamp() for all dimensions
 *   - No grey text below #E2E8F0
 *   - cursor-pointer on all interactive elements
 *
 * Authority: sentinel.md v1.2.0
 * Existing features preserved: Yes
 */

import { useState } from 'react';
import type { DashboardData, WeeklyDigest } from '@/lib/sentinel/dashboard-data';

// =============================================================================
// COMPONENT
// =============================================================================

export function SentinelDashboard({ data }: { data: DashboardData }) {
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const currentWeek = data.weeks[selectedWeek] ?? null;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0F172A',
      color: '#F1F5F9',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: 'clamp(1rem, 2vw, 2rem)',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'clamp(1.5rem, 2vw, 2rem)',
      }}>
        <div>
          <h1 style={{
            fontSize: 'clamp(1.5rem, 2.5vw, 2.5rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            margin: 0,
          }}>
            Sentinel Dashboard
          </h1>
          <p style={{
            fontSize: 'clamp(0.85rem, 1.2vw, 1rem)',
            color: '#E2E8F0',
            marginTop: 'clamp(0.25rem, 0.5vw, 0.5rem)',
          }}>
            AI Visibility Intelligence — {data.weeks.length} weeks of data
          </p>
        </div>

        {/* Health score badge */}
        {data.currentHealthScore !== null && (
          <div style={{
            background: getHealthColor(data.currentHealthScore),
            borderRadius: 'clamp(0.5rem, 1vw, 1rem)',
            padding: 'clamp(0.75rem, 1.5vw, 1.5rem) clamp(1rem, 2vw, 2rem)',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 'clamp(2rem, 3.5vw, 3.5rem)',
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1,
            }}>
              {data.currentHealthScore}
            </div>
            <div style={{
              fontSize: 'clamp(0.7rem, 1vw, 0.85rem)',
              color: '#FFFFFF',
              marginTop: '0.25rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Health Score
            </div>
          </div>
        )}
      </header>

      {/* Trend summary */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(180px, 20vw, 250px), 1fr))',
        gap: 'clamp(0.75rem, 1.5vw, 1.5rem)',
        marginBottom: 'clamp(1.5rem, 2vw, 2rem)',
      }}>
        <StatCard label="Trend" value={trendLabel(data.healthTrend)} color={trendColor(data.healthTrend)} />
        <StatCard
          label="Active Regressions"
          value={String(data.topUnresolvedRegressions.length)}
          color={data.topUnresolvedRegressions.length > 3 ? '#F87171' : '#34D399'}
        />
        <StatCard
          label="Weeks Tracked"
          value={String(data.weeks.length)}
          color="#60A5FA"
        />
        <SparklineCard label="Regressions (12 weeks)" values={data.regressionTrend} />
      </div>

      {/* Weekly cards */}
      <h2 style={{
        fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)',
        color: '#FFFFFF',
        marginBottom: 'clamp(0.75rem, 1vw, 1rem)',
      }}>
        Weekly Reports
      </h2>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 25vw, 360px), 1fr))',
        gap: 'clamp(0.75rem, 1vw, 1rem)',
        marginBottom: 'clamp(1.5rem, 2vw, 2rem)',
      }}>
        {data.weeks.map((week, idx) => (
          <WeekCard
            key={week.runDate}
            week={week}
            selected={idx === selectedWeek}
            onClick={() => setSelectedWeek(idx)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {currentWeek && <WeekDetail week={currentWeek} />}

      {/* Top unresolved regressions */}
      {data.topUnresolvedRegressions.length > 0 && (
        <div style={{
          background: '#1E293B',
          borderRadius: 'clamp(0.5rem, 1vw, 0.75rem)',
          padding: 'clamp(1rem, 1.5vw, 1.5rem)',
          marginTop: 'clamp(1.5rem, 2vw, 2rem)',
        }}>
          <h3 style={{
            fontSize: 'clamp(1rem, 1.4vw, 1.2rem)',
            color: '#FFFFFF',
            marginBottom: 'clamp(0.75rem, 1vw, 1rem)',
            margin: 0,
          }}>
            Unresolved Regressions
          </h3>
          <div style={{ marginTop: 'clamp(0.5rem, 0.75vw, 0.75rem)' }}>
            {data.topUnresolvedRegressions.map((reg, idx) => (
              <div
                key={`${reg.url}-${reg.regressionType}-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'clamp(0.4rem, 0.6vw, 0.6rem) 0',
                  borderBottom: '1px solid #334155',
                }}
              >
                <div>
                  <span style={{ color: severityColor(reg.severity) }}>
                    {severityIcon(reg.severity)}
                  </span>
                  <span style={{ color: '#F1F5F9', marginLeft: '0.5rem', fontSize: 'clamp(0.8rem, 1.1vw, 0.95rem)' }}>
                    {reg.url}
                  </span>
                  <span style={{ color: '#E2E8F0', marginLeft: '0.75rem', fontSize: 'clamp(0.7rem, 1vw, 0.85rem)' }}>
                    {reg.regressionType.replace(/_/g, ' ')}
                  </span>
                </div>
                <span style={{
                  color: reg.consecutiveWeeks >= 4 ? '#F87171' : '#FBBF24',
                  fontSize: 'clamp(0.7rem, 1vw, 0.85rem)',
                  fontWeight: 600,
                }}>
                  week {reg.consecutiveWeeks}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#1E293B',
      borderRadius: 'clamp(0.5rem, 1vw, 0.75rem)',
      padding: 'clamp(0.75rem, 1.5vw, 1.25rem)',
    }}>
      <div style={{ fontSize: 'clamp(0.75rem, 1vw, 0.85rem)', color: '#E2E8F0' }}>{label}</div>
      <div style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 700, color, marginTop: '0.25rem' }}>
        {value}
      </div>
    </div>
  );
}

function SparklineCard({ label, values }: { label: string; values: number[] }) {
  const max = Math.max(...values, 1);
  const height = 40;

  return (
    <div style={{
      background: '#1E293B',
      borderRadius: 'clamp(0.5rem, 1vw, 0.75rem)',
      padding: 'clamp(0.75rem, 1.5vw, 1.25rem)',
    }}>
      <div style={{ fontSize: 'clamp(0.75rem, 1vw, 0.85rem)', color: '#E2E8F0', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${values.length * 12} ${height}`}>
        {values.map((v, i) => (
          <rect
            key={i}
            x={i * 12 + 1}
            y={height - (v / max) * height}
            width={10}
            height={Math.max(2, (v / max) * height)}
            fill={v > 3 ? '#F87171' : v > 0 ? '#FBBF24' : '#34D399'}
            rx={2}
          />
        ))}
      </svg>
    </div>
  );
}

function WeekCard({
  week,
  selected,
  onClick,
}: {
  week: WeeklyDigest;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected ? '#334155' : '#1E293B',
        border: selected ? '2px solid #60A5FA' : '2px solid transparent',
        borderRadius: 'clamp(0.5rem, 1vw, 0.75rem)',
        padding: 'clamp(0.75rem, 1.2vw, 1rem)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'border-color 0.15s',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 'clamp(0.85rem, 1.2vw, 1rem)' }}>
          {week.runDate}
        </span>
        <span style={{
          color: '#FFFFFF',
          fontWeight: 800,
          fontSize: 'clamp(1.2rem, 1.8vw, 1.5rem)',
          background: getHealthColor(week.healthScore),
          borderRadius: 'clamp(0.25rem, 0.5vw, 0.4rem)',
          padding: '0.1rem 0.5rem',
        }}>
          {week.healthScore}
        </span>
      </div>
      <div style={{ marginTop: '0.5rem', fontSize: 'clamp(0.75rem, 1vw, 0.85rem)', color: '#E2E8F0' }}>
        {week.pagesHealthy}/{week.pagesTotal} healthy
        {week.regressionsTotal > 0 && (
          <span style={{ color: '#F87171', marginLeft: '0.75rem' }}>
            {week.regressionsTotal} regressions
          </span>
        )}
      </div>
    </button>
  );
}

function WeekDetail({ week }: { week: WeeklyDigest }) {
  return (
    <div style={{
      background: '#1E293B',
      borderRadius: 'clamp(0.5rem, 1vw, 0.75rem)',
      padding: 'clamp(1rem, 1.5vw, 1.5rem)',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(clamp(140px, 14vw, 180px), 1fr))',
      gap: 'clamp(0.75rem, 1vw, 1rem)',
    }}>
      <MetricCell label="Pages Healthy" value={`${week.pagesHealthy}/${week.pagesTotal}`} />
      <MetricCell label="Meta Descriptions" value={`${week.metaDescCount}/${week.pagesTotal}`} />
      <MetricCell label="Canonicals" value={`${week.canonicalCount}/${week.pagesTotal}`} />
      <MetricCell label="Schema Coverage" value={`${week.schemaCount}/${week.pagesTotal}`} />
      <MetricCell label="Orphan Pages" value={String(week.orphanCount)} alert={week.orphanCount > 3} />
      <MetricCell label="Avg Response" value={week.avgResponseMs ? `${week.avgResponseMs}ms` : '—'} />
      <MetricCell label="Critical" value={String(week.regressionsCritical)} alert={week.regressionsCritical > 0} />
      <MetricCell label="High" value={String(week.regressionsHigh)} alert={week.regressionsHigh > 0} />
    </div>
  );
}

function MetricCell({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 'clamp(0.7rem, 0.9vw, 0.8rem)', color: '#E2E8F0' }}>{label}</div>
      <div style={{
        fontSize: 'clamp(1.1rem, 1.6vw, 1.4rem)',
        fontWeight: 700,
        color: alert ? '#F87171' : '#FFFFFF',
        marginTop: '0.15rem',
      }}>
        {value}
      </div>
    </div>
  );
}

// =============================================================================
// UTILITIES
// =============================================================================

function getHealthColor(score: number): string {
  if (score >= 80) return '#065F46';
  if (score >= 60) return '#78350F';
  return '#7F1D1D';
}

function trendLabel(trend: string): string {
  if (trend === 'improving') return '▲ Improving';
  if (trend === 'declining') return '▼ Declining';
  if (trend === 'stable') return '→ Stable';
  return '— Insufficient';
}

function trendColor(trend: string): string {
  if (trend === 'improving') return '#34D399';
  if (trend === 'declining') return '#F87171';
  return '#FBBF24';
}

function severityIcon(sev: string): string {
  if (sev === 'CRITICAL') return '🔴';
  if (sev === 'HIGH') return '🟠';
  if (sev === 'MEDIUM') return '🟡';
  return '🔵';
}

function severityColor(sev: string): string {
  if (sev === 'CRITICAL') return '#F87171';
  if (sev === 'HIGH') return '#FB923C';
  if (sev === 'MEDIUM') return '#FBBF24';
  return '#60A5FA';
}
