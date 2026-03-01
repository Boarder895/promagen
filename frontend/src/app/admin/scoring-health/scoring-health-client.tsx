'use client';

// src/app/admin/scoring-health/scoring-health-client.tsx
// ============================================================================
// SCORING HEALTH CLIENT — Dashboard shell with sidebar + section containers
// ============================================================================
//
// Client component that renders:
//   - Anomaly Alert Banner (pinned top — monitors all pipeline health)
//   - Undo timeline strip (above sections)
//   - Sticky sidebar nav (left)
//   - Main content area (right) with section containers
//   - DrillThroughProvider wrapping all sections for cross-section navigation
//
// All 10 sections + Anomaly Banner:
//   - 🚨 Anomaly Alert Banner                  (7.11g)
//   - Section 1:  Scorer Health Overview        (7.11a)
//   - Section 2:  Weight Drift Chart            (7.11b)
//   - Section 3:  Tier Models Heatmap           (7.11b) + Click-to-edit
//   - Section 4:  Term Quality Leaderboard      (7.11c) + Inspector (7.11d) + Drill-through
//   - Section 5:  Anti-Pattern Alerts           (7.11d) + Drill-through
//   - Section 6:  A/B Test Results              (7.11d)
//   - Section 8:  Temporal Trends               (7.11e)
//   - Section 9:  Skill Distribution            (7.11f)
//   - Section 10: Feedback Summary              (7.11e) + Drill-through
//   - Section 11: Configuration Profiles        (Live Control Panel + Rollback)
//
// Cross-Section Drill-Through Flows (7.11g):
//   Banner → any section (smooth-scroll + pulse-highlight)
//   Section 10 (platform click) → Section 5 (anti-patterns with platform badge)
//   Section 5 (term click) → Section 4 (auto-opens term inspector)
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md
//
// Version: 10.0.0 — 7.11j Code Evolution Radar (Section 12 — 12 sections live)
// Created: 2026-03-01
//
// Existing features preserved: Yes.
// ============================================================================

import { useCallback, useState } from 'react';
import { ScoringHealthNav } from '@/components/admin/scoring-health/scoring-health-nav';
import { ScorerHealthOverview } from '@/components/admin/scoring-health/scorer-health-overview';
import { WeightDriftChart } from '@/components/admin/scoring-health/weight-drift-chart';
import { TierModelsHeatmap } from '@/components/admin/scoring-health/tier-models-heatmap';
import { TermQualityLeaderboard } from '@/components/admin/scoring-health/term-quality-leaderboard';
import { AntiPatternAlerts } from '@/components/admin/scoring-health/anti-pattern-alerts';
import { ABTestSection } from '@/components/admin/scoring-health/ab-test-section';
import { PipelineDependencyGraph } from '@/components/admin/scoring-health/pipeline-dependency-graph';
import { TemporalTrendsPanel } from '@/components/admin/scoring-health/temporal-trends-panel';
import { SkillDistributionPanel } from '@/components/admin/scoring-health/skill-distribution-panel';
import { FeedbackSummaryPanel } from '@/components/admin/scoring-health/feedback-summary-panel';
import { ProfileManager } from '@/components/admin/scoring-health/profile-manager';
import { UndoTimeline } from '@/components/admin/scoring-health/undo-timeline';
import { AnomalyAlertBanner } from '@/components/admin/scoring-health/anomaly-alert-banner';
import { CodeEvolutionRadar } from '@/components/admin/scoring-health/code-evolution-radar';
import { DrillThroughProvider } from '@/lib/admin/drill-through-context';
import type { UndoEntry, WeightEditRevert } from '@/lib/admin/undo-stack';
import { pushUndoEntry, markUndone } from '@/lib/admin/undo-stack';

// ============================================================================
// COMPONENT
// ============================================================================

export function ScoringHealthClient() {
  // ── Undo stack state ────────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);

  /** Push a new action onto the undo stack (called by weight editor, profiles, etc.) */
  const pushAction = useCallback((entry: Omit<UndoEntry, 'id' | 'timestamp' | 'undone'>) => {
    setUndoStack((prev) => pushUndoEntry(prev, entry));
  }, []);

  /** Handle undo — revert a weight edit via API */
  const handleUndo = useCallback(async (entry: UndoEntry) => {
    if (entry.revertPayload.type === 'weight-edit') {
      const payload = entry.revertPayload as WeightEditRevert;
      try {
        const res = await fetch('/api/admin/scoring-health/weight-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tier: payload.tier,
            factor: payload.factor,
            newWeight: payload.previousWeight,
            normalise: payload.normalise,
          }),
        });
        if (!res.ok) throw new Error('Undo API failed');
      } catch {
         
        console.error('[Undo] Failed to revert weight edit:', entry.description);
        return;
      }
    }

    setUndoStack((prev) => markUndone(prev, entry.id).stack);
  }, []);

  void pushAction;

  return (
    <DrillThroughProvider>
      <div>
        {/* ── Page Header ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 'clamp(16px, 2vw, 24px)' }}>
          <h1
            className="font-bold text-white/90"
            style={{ fontSize: 'clamp(20px, 2.5vw, 32px)' }}
          >
            Scoring Health
          </h1>
          <p
            className="text-white/40"
            style={{ fontSize: 'clamp(11px, 1vw, 14px)', marginTop: 'clamp(2px, 0.3vw, 4px)' }}
          >
            Comprehensive health dashboard for the self-improving scoring system.
            Monitors correlation, weight drift, term quality, and pipeline status.
          </p>
        </div>

        {/* ── Anomaly Alert Banner (always top) ──────────────────────── */}
        <div style={{ marginBottom: 'clamp(8px, 1vw, 12px)' }}>
          <AnomalyAlertBanner />
        </div>

        {/* ── Undo Timeline (above layout) ───────────────────────────── */}
        <div style={{ marginBottom: 'clamp(8px, 1vw, 12px)' }}>
          <UndoTimeline entries={undoStack} onUndo={handleUndo} />
        </div>

        {/* ── Layout: Sidebar + Content ──────────────────────────────── */}
        <div
          className="flex"
          style={{ gap: 'clamp(16px, 2vw, 28px)', alignItems: 'flex-start' }}
        >
          {/* ── Sidebar Nav ────────────────────────────────────────── */}
          <ScoringHealthNav />

          {/* ── Main Content ───────────────────────────────────────── */}
          <div
            className="flex min-w-0 flex-1 flex-col"
            style={{ gap: 'clamp(16px, 2vw, 24px)' }}
          >
            {/* ── Section 1: Scorer Health Overview ──────────────── */}
            <section id="scorer-health" className="scroll-mt-24">
              <ScorerHealthOverview />
            </section>

            {/* ── Section 2: Weight Drift ────────────────────────── */}
            <section id="weight-drift" className="scroll-mt-24">
              <WeightDriftChart />
            </section>

            {/* ── Section 3: Per-Tier Models (+ click-to-edit) ───── */}
            <section id="tier-models" className="scroll-mt-24">
              <TierModelsHeatmap />
            </section>

            {/* ── Section 4: Term Quality Leaderboard ────────────── */}
            <section id="term-quality" className="scroll-mt-24">
              <TermQualityLeaderboard />
            </section>

            {/* ── Section 5: Anti-Pattern Alerts ─────────────────── */}
            <section id="anti-patterns" className="scroll-mt-24">
              <AntiPatternAlerts />
            </section>

            {/* ── Section 6: A/B Test Results ────────────────────── */}
            <section id="ab-tests" className="scroll-mt-24">
              <ABTestSection />
            </section>

            {/* ── Section 7: Pipeline Dependency Graph ───────────── */}
            <section id="pipeline-graph" className="scroll-mt-24">
              <PipelineDependencyGraph />
            </section>

            {/* ── Section 8: Temporal Trends ──────────────────────── */}
            <section id="temporal-trends" className="scroll-mt-24">
              <TemporalTrendsPanel />
            </section>

            {/* ── Section 9: Skill Distribution ──────────────────── */}
            <section id="skill-distribution" className="scroll-mt-24">
              <SkillDistributionPanel />
            </section>

            {/* ── Section 10: Feedback Summary ────────────────────── */}
            <section id="feedback-summary" className="scroll-mt-24">
              <FeedbackSummaryPanel />
            </section>

            {/* ── Section 12: Code Evolution Radar ───────────────── */}
            <section id="code-radar" className="scroll-mt-24">
              <CodeEvolutionRadar />
            </section>

            {/* ── Section 11: Configuration Profiles & Rollback ──── */}
            <section id="control-panel" className="scroll-mt-24">
              <ProfileManager />
            </section>
          </div>
        </div>
      </div>
    </DrillThroughProvider>
  );
}
