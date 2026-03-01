'use client';

// src/app/admin/page.tsx
// ============================================================================
// ADMIN DASHBOARD — Quick-access hub for all admin tools
// ============================================================================
//
// Replaces the old placeholder page with a clean dashboard showing
// quick-access cards for each admin section.
//
// Version: 6.0.0 — Phase 7.11a (add Scoring Health card)
// Created: 2026-02-27
//
// Existing features preserved: Yes.
// ============================================================================

import Link from 'next/link';

import { TemporalFreshnessBadge } from '@/components/admin/temporal-freshness-badge';
import { CompressionDashboard } from '@/components/admin/compression-dashboard';
import { FeedbackPulseDashboard } from '@/components/admin/feedback-pulse-dashboard';

const TOOLS = [
  {
    href: '/admin/scoring-health',
    label: 'Scoring Health',
    description: 'Comprehensive dashboard: correlation metrics, weight drift, term quality, A/B tests, pipeline uptime.',
    icon: '🩺',
    colour: 'bg-emerald-500/15 ring-emerald-500/30 hover:bg-emerald-500/25',
  },
  {
    href: '/admin/vocab-submissions',
    label: 'Vocab Queue',
    description: 'Review user-submitted custom vocabulary terms. Scan, reject, accept in batch.',
    icon: '📝',
    colour: 'bg-violet-500/15 ring-violet-500/30 hover:bg-violet-500/25',
  },
  {
    href: '/admin/scene-candidates',
    label: 'Scene Candidates',
    description: 'Auto-generated scene proposals from nightly telemetry clustering.',
    icon: '🎬',
    colour: 'bg-emerald-500/15 ring-emerald-500/30 hover:bg-emerald-500/25',
  },
  {
    href: '/admin/providers',
    label: 'Providers',
    description: 'Browse and inspect all AI image providers with Promagen Users data.',
    icon: '🤖',
    colour: 'bg-sky-500/15 ring-sky-500/30 hover:bg-sky-500/25',
  },
  {
    href: '/admin/exchanges',
    label: 'Exchanges',
    description: 'Exchange configuration editor for market data sources.',
    icon: '📊',
    colour: 'bg-amber-500/15 ring-amber-500/30 hover:bg-amber-500/25',
  },
] as const;

export default function AdminDashboard() {
  return (
    <div>
      <h1
        style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}
        className="mb-2 font-bold"
      >
        Admin Dashboard
      </h1>
      <p
        style={{ fontSize: 'clamp(12px, 1.2vw, 15px)' }}
        className="mb-8 text-white/50"
      >
        Internal control panel for Promagen data sources and intelligence pipelines.
      </p>

      {/* ── Pipeline Health ─────────────────────────────────────────── */}
      <h2
        className="mb-3 font-semibold text-white/60"
        style={{ fontSize: 'clamp(12px, 1.1vw, 14px)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}
      >
        Pipeline Health
      </h2>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TemporalFreshnessBadge />
        <CompressionDashboard />
        <FeedbackPulseDashboard />
      </div>

      {/* ── Tools ───────────────────────────────────────────────────── */}
      <h2
        className="mb-3 font-semibold text-white/60"
        style={{ fontSize: 'clamp(12px, 1.1vw, 14px)', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}
      >
        Tools
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map(({ href, label, description, icon, colour }) => (
          <Link
            key={href}
            href={href}
            className={`group rounded-xl ring-1 transition-all ${colour}`}
            style={{ padding: 'clamp(16px, 2vw, 24px)' }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span style={{ fontSize: 'clamp(20px, 2vw, 28px)' }}>{icon}</span>
              <h2
                className="font-semibold text-white/90"
                style={{ fontSize: 'clamp(15px, 1.5vw, 20px)' }}
              >
                {label}
              </h2>
              <span
                className="ml-auto text-white/20 transition-transform group-hover:translate-x-1"
                style={{ fontSize: 'clamp(14px, 1.4vw, 18px)' }}
              >
                →
              </span>
            </div>
            <p
              className="text-white/40"
              style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
            >
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
