// src/components/providers/optimization-transparency-panel.tsx
// ============================================================================
// OPTIMIZATION TRANSPARENCY PANEL v2.0.0
// ============================================================================
// Pro-only collapsible panel that shows users exactly why the optimizer
// made each decision. Grouped by optimization phase:
//   Phase 0: Redundancy removal (free quality improvement)
//   Phase 1: CLIP token overflow (invisible terms past 77-token limit)
//   Phase 2/3: Scored term removal (category weight × position decay)
//   Phase 4: Prompt compression (verbose → concise rewrites)
//   Phase C: Budget-aware conversions (fidelity + negative → platform-native)
//
// No competitor shows optimization reasoning — this builds trust,
// teaches prompt engineering, and differentiates Pro tier.
//
// Authority: docs/authority/prompt-builder-page.md
// v2.0.0: Added Conversions section (Part 10a)
// ============================================================================

'use client';

import React, { useState } from 'react';
import type { ConversionResultMeta } from '@/types/prompt-builder';

// ============================================================================
// TYPES
// ============================================================================

interface RemovedTermData {
  readonly term: string;
  readonly category: string;
  readonly score: number;
  readonly reason: 'redundant' | 'past-token-limit' | 'lowest-score' | 'compressed';
}

export interface OptimizationTransparencyPanelProps {
  /** Raw removed terms from optimizer */
  removedTerms: ReadonlyArray<RemovedTermData>;
  /** Which phase achieved the target (0-4, or -1 if already within) */
  achievedAtPhase: number;
  /** Original character count */
  originalLength: number;
  /** Final optimized character count */
  optimizedLength: number;
  /** Whether user is on paid tier */
  isPro: boolean;

  // ── Part 10a: Conversion metadata ──
  /** Budget-aware conversion results from AssembledPrompt.conversions */
  conversions?: ConversionResultMeta[];
  /** Budget state at assembly time */
  conversionBudget?: {
    ceiling: number;
    coreLength: number;
    remaining: number;
    unit: 'words';
    source: 'learned' | 'static';
  };
}

// ============================================================================
// PHASE METADATA
// ============================================================================

const PHASE_CONFIG: Record<
  RemovedTermData['reason'],
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
  }
> = {
  redundant: {
    label: 'Redundancy Removal',
    icon: '♻',
    color: 'text-cyan-300',
    bgColor: 'bg-cyan-950/30',
    borderColor: 'border-cyan-800/40',
    description: 'Duplicate or semantically similar terms removed — no visual impact.',
  },
  'past-token-limit': {
    label: 'CLIP Token Overflow',
    icon: '⚡',
    color: 'text-orange-300',
    bgColor: 'bg-orange-950/30',
    borderColor: 'border-orange-800/40',
    description: 'Terms past the 77-token CLIP limit — the AI literally cannot see these.',
  },
  'lowest-score': {
    label: 'Priority Scoring',
    icon: '📊',
    color: 'text-violet-300',
    bgColor: 'bg-violet-950/30',
    borderColor: 'border-violet-800/40',
    description: 'Lowest-impact terms removed first based on category weight × position.',
  },
  compressed: {
    label: 'Phrase Compression',
    icon: '🗜',
    color: 'text-emerald-300',
    bgColor: 'bg-emerald-950/30',
    borderColor: 'border-emerald-800/40',
    description: 'Verbose phrases rewritten to concise equivalents — same visual meaning.',
  },
};

const PHASE_ORDER: Array<RemovedTermData['reason']> = [
  'redundant',
  'past-token-limit',
  'lowest-score',
  'compressed',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function OptimizationTransparencyPanel({
  removedTerms,
  achievedAtPhase,
  originalLength,
  optimizedLength,
  isPro,
  conversions,
  conversionBudget,
}: OptimizationTransparencyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render for free users or if nothing happened
  const hasOptimizations = removedTerms.length > 0;
  const hasConversions = conversions && conversions.length > 0;
  if (!isPro || (!hasOptimizations && !hasConversions)) return null;

  // Conversion stats
  const includedConversions = conversions?.filter((c) => c.included) ?? [];
  const deferredConversions = conversions?.filter((c) => !c.included) ?? [];
  const totalConversions = conversions?.length ?? 0;

  // Group terms by reason
  const grouped = PHASE_ORDER.reduce(
    (acc, reason) => {
      const terms = removedTerms.filter((t) => t.reason === reason);
      if (terms.length > 0) acc[reason] = terms;
      return acc;
    },
    {} as Record<string, ReadonlyArray<RemovedTermData>>,
  );

  const activePhases = Object.keys(grouped);
  const charsSaved = originalLength - optimizedLength;

  // Phase number labels for achievedAtPhase display
  const phaseNumberLabels: Record<RemovedTermData['reason'], number> = {
    redundant: 0,
    'past-token-limit': 1,
    'lowest-score': 3,
    compressed: 4,
  };

  return (
    <div
      className="rounded-lg border border-slate-700/50 bg-slate-900/40 overflow-hidden"
      style={{ marginTop: 'clamp(4px, 0.4vw, 6px)' }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between transition-colors hover:bg-slate-800/30"
        style={{
          padding: 'clamp(6px, 0.5vw, 10px) clamp(8px, 0.7vw, 12px)',
          gap: 'clamp(4px, 0.4vw, 6px)',
        }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
          <span
            className="text-purple-400 transition-transform"
            style={{
              fontSize: 'clamp(8px, 0.6vw, 10px)',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ▶
          </span>
          <span
            className="font-medium text-purple-300"
            style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.75rem)' }}
          >
            Optimization Insights
          </span>
          <span
            className="rounded-full bg-purple-500/20 text-purple-400 font-medium tabular-nums"
            style={{
              fontSize: 'clamp(8px, 0.55vw, 10px)',
              padding: 'clamp(1px, 0.1vw, 2px) clamp(5px, 0.4vw, 8px)',
            }}
          >
            PRO
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
          {/* Mini summary when collapsed */}
          {!isExpanded && (
            <span
              className="text-slate-400 tabular-nums"
              style={{ fontSize: 'clamp(8px, 0.6vw, 10px)' }}
            >
              {hasOptimizations && (
                <>
                  {activePhases.length} phase{activePhases.length !== 1 ? 's' : ''} ·{' '}
                  {removedTerms.length} action{removedTerms.length !== 1 ? 's' : ''} · −{charsSaved} chars
                </>
              )}
              {hasOptimizations && hasConversions && ' · '}
              {hasConversions && (
                <span className="text-amber-400">
                  {includedConversions.length}/{totalConversions} converted
                </span>
              )}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="border-t border-slate-700/40"
          style={{ padding: 'clamp(8px, 0.6vw, 12px)' }}
        >
          {/* Phase pipeline visualization */}
          <div
            className="flex items-center flex-wrap"
            style={{ gap: 'clamp(3px, 0.3vw, 5px)', marginBottom: 'clamp(8px, 0.6vw, 12px)' }}
          >
            {PHASE_ORDER.map((reason, i) => {
              const config = PHASE_CONFIG[reason];
              const isActive = reason in grouped;
              const isAchieved = phaseNumberLabels[reason] === achievedAtPhase;
              return (
                <React.Fragment key={reason}>
                  {i > 0 && (
                    <span
                      className="text-slate-600"
                      style={{ fontSize: 'clamp(8px, 0.6vw, 10px)' }}
                    >
                      →
                    </span>
                  )}
                  <span
                    className={`rounded-full font-medium ${
                      isAchieved
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40'
                        : isActive
                          ? `${config.bgColor} ${config.color}`
                          : 'bg-slate-800/40 text-slate-500'
                    }`}
                    style={{
                      fontSize: 'clamp(7px, 0.55vw, 9px)',
                      padding: 'clamp(2px, 0.15vw, 3px) clamp(5px, 0.4vw, 8px)',
                    }}
                  >
                    {config.icon} P{phaseNumberLabels[reason]}
                    {isAchieved && ' ✓'}
                  </span>
                </React.Fragment>
              );
            })}
            {achievedAtPhase >= 0 && (
              <span
                className="text-emerald-400/60"
                style={{
                  fontSize: 'clamp(7px, 0.55vw, 9px)',
                  marginLeft: 'clamp(4px, 0.3vw, 6px)',
                }}
              >
                Target reached at Phase {achievedAtPhase}
              </span>
            )}
          </div>

          {/* Phase groups */}
          <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.5vw, 10px)' }}>
            {PHASE_ORDER.map((reason) => {
              const terms = grouped[reason];
              if (!terms) return null;
              const config = PHASE_CONFIG[reason];

              return (
                <div
                  key={reason}
                  className={`rounded-lg border ${config.borderColor} ${config.bgColor}`}
                  style={{ padding: 'clamp(6px, 0.5vw, 10px)' }}
                >
                  {/* Phase header */}
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: 'clamp(4px, 0.3vw, 6px)' }}
                  >
                    <div className="flex items-center" style={{ gap: 'clamp(4px, 0.3vw, 6px)' }}>
                      <span style={{ fontSize: 'clamp(10px, 0.7vw, 13px)' }}>{config.icon}</span>
                      <span
                        className={`font-medium ${config.color}`}
                        style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.75rem)' }}
                      >
                        {config.label}
                      </span>
                      <span
                        className="text-slate-500"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        ({terms.length} term{terms.length !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>

                  {/* Phase description */}
                  <p
                    className="text-slate-400"
                    style={{
                      fontSize: 'clamp(8px, 0.55vw, 10px)',
                      marginBottom: 'clamp(6px, 0.4vw, 8px)',
                      lineHeight: 1.4,
                    }}
                  >
                    {config.description}
                  </p>

                  {/* Terms list */}
                  {reason === 'lowest-score' ? (
                    // Scored terms get a table with score breakdown
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="text-left">
                            <th
                              className="text-slate-500 font-medium"
                              style={{
                                fontSize: 'clamp(7px, 0.5vw, 9px)',
                                padding: 'clamp(2px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)',
                              }}
                            >
                              Term
                            </th>
                            <th
                              className="text-slate-500 font-medium"
                              style={{
                                fontSize: 'clamp(7px, 0.5vw, 9px)',
                                padding: 'clamp(2px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)',
                              }}
                            >
                              Category
                            </th>
                            <th
                              className="text-slate-500 font-medium text-right"
                              style={{
                                fontSize: 'clamp(7px, 0.5vw, 9px)',
                                padding: 'clamp(2px, 0.15vw, 3px) clamp(4px, 0.3vw, 6px)',
                              }}
                            >
                              Score
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...terms]
                            .sort((a, b) => a.score - b.score)
                            .map((t, i) => (
                              <tr key={i} className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}>
                                <td
                                  className="text-violet-200 font-mono"
                                  style={{
                                    fontSize: 'clamp(8px, 0.55vw, 10px)',
                                    padding: 'clamp(2px, 0.15vw, 4px) clamp(4px, 0.3vw, 6px)',
                                  }}
                                >
                                  {t.term}
                                </td>
                                <td
                                  className="text-slate-400"
                                  style={{
                                    fontSize: 'clamp(8px, 0.55vw, 10px)',
                                    padding: 'clamp(2px, 0.15vw, 4px) clamp(4px, 0.3vw, 6px)',
                                  }}
                                >
                                  {t.category}
                                </td>
                                <td
                                  className="text-violet-400 tabular-nums text-right font-mono"
                                  style={{
                                    fontSize: 'clamp(8px, 0.55vw, 10px)',
                                    padding: 'clamp(2px, 0.15vw, 4px) clamp(4px, 0.3vw, 6px)',
                                  }}
                                >
                                  {t.score.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    // Other phases: simple chip list
                    <div className="flex flex-wrap" style={{ gap: 'clamp(3px, 0.25vw, 4px)' }}>
                      {terms.map((t, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center rounded-md border ${config.borderColor} ${config.bgColor}`}
                          style={{
                            fontSize: 'clamp(8px, 0.55vw, 10px)',
                            padding: 'clamp(1px, 0.1vw, 2px) clamp(4px, 0.3vw, 6px)',
                            gap: 'clamp(2px, 0.2vw, 4px)',
                          }}
                        >
                          <span className="text-slate-500">✕</span>
                          <span className={config.color}>{t.term}</span>
                          <span className="text-slate-600">({t.category})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Part 10a: Conversions Section ────────────────────── */}
          {hasConversions && (
            <div
              className="rounded-lg border border-amber-800/40 bg-amber-950/20"
              style={{
                padding: 'clamp(6px, 0.5vw, 10px)',
                marginTop: 'clamp(6px, 0.5vw, 10px)',
              }}
            >
              {/* Conversions header */}
              <div
                className="flex items-center justify-between"
                style={{ marginBottom: 'clamp(4px, 0.3vw, 6px)' }}
              >
                <div className="flex items-center" style={{ gap: 'clamp(4px, 0.3vw, 6px)' }}>
                  <span style={{ fontSize: 'clamp(10px, 0.7vw, 13px)' }}>🔄</span>
                  <span
                    className="font-medium text-amber-300"
                    style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.75rem)' }}
                  >
                    Conversions
                  </span>
                  <span
                    className="text-amber-400 tabular-nums"
                    style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                  >
                    ({includedConversions.length} included
                    {deferredConversions.length > 0 && ` · ${deferredConversions.length} deferred`})
                  </span>
                </div>
                {conversionBudget && (
                  <span
                    className="text-amber-400 tabular-nums"
                    style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                  >
                    Budget: {conversionBudget.remaining}w / {conversionBudget.ceiling}w
                    {conversionBudget.source === 'learned' && (
                      <span className="text-emerald-400"> (learned)</span>
                    )}
                  </span>
                )}
              </div>

              {/* Description */}
              <p
                className="text-amber-200"
                style={{
                  fontSize: 'clamp(8px, 0.55vw, 10px)',
                  marginBottom: 'clamp(6px, 0.4vw, 8px)',
                  lineHeight: 1.4,
                }}
              >
                Fidelity and negative terms converted to platform-native equivalents within prompt budget.
              </p>

              {/* Conversion items */}
              <div className="flex flex-col" style={{ gap: 'clamp(2px, 0.15vw, 3px)' }}>
                {/* Included conversions first */}
                {includedConversions.map((c, i) => (
                  <div
                    key={`inc-${i}`}
                    className="flex items-center justify-between rounded-md bg-emerald-950/30 border border-emerald-800/30"
                    style={{
                      padding: 'clamp(3px, 0.2vw, 5px) clamp(6px, 0.4vw, 8px)',
                    }}
                  >
                    <div className="flex items-center" style={{ gap: 'clamp(4px, 0.3vw, 6px)' }}>
                      <span
                        className="text-emerald-400"
                        style={{ fontSize: 'clamp(10px, 0.65vw, 12px)' }}
                      >
                        ✅
                      </span>
                      <span
                        className="text-amber-200 font-mono"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        {c.from}
                      </span>
                      <span
                        className="text-slate-500"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        →
                      </span>
                      <span
                        className="text-emerald-300 font-mono"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        {c.to}
                      </span>
                    </div>
                    <span
                      className="text-emerald-400 tabular-nums"
                      style={{ fontSize: 'clamp(7px, 0.5vw, 9px)' }}
                    >
                      {c.isParametric ? 'parametric — free' : `${c.cost}w · ${c.score.toFixed(2)}`}
                    </span>
                  </div>
                ))}

                {/* Deferred conversions */}
                {deferredConversions.map((c, i) => (
                  <div
                    key={`def-${i}`}
                    className="flex items-center justify-between rounded-md bg-slate-800/30 border border-slate-700/30"
                    style={{
                      padding: 'clamp(3px, 0.2vw, 5px) clamp(6px, 0.4vw, 8px)',
                    }}
                  >
                    <div className="flex items-center" style={{ gap: 'clamp(4px, 0.3vw, 6px)' }}>
                      <span
                        className="text-slate-400"
                        style={{ fontSize: 'clamp(10px, 0.65vw, 12px)' }}
                      >
                        ⏸
                      </span>
                      <span
                        className="text-slate-300 font-mono"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        {c.from}
                      </span>
                      <span
                        className="text-slate-500"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        →
                      </span>
                      <span
                        className="text-slate-400 font-mono"
                        style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}
                      >
                        {c.to}
                      </span>
                    </div>
                    <span
                      className="text-amber-400 tabular-nums"
                      style={{ fontSize: 'clamp(7px, 0.5vw, 9px)' }}
                    >
                      deferred — {c.reason ?? 'budget'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary footer */}
          <div
            className="flex items-center justify-between border-t border-slate-700/30"
            style={{
              marginTop: 'clamp(8px, 0.6vw, 12px)',
              paddingTop: 'clamp(6px, 0.4vw, 8px)',
            }}
          >
            <span className="text-slate-500" style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}>
              {hasOptimizations && (
                <>
                  {removedTerms.length} optimization{removedTerms.length !== 1 ? 's' : ''} across{' '}
                  {activePhases.length} phase{activePhases.length !== 1 ? 's' : ''}
                </>
              )}
              {hasOptimizations && hasConversions && ' · '}
              {hasConversions && (
                <span className="text-amber-400">
                  {includedConversions.length}/{totalConversions} conversions included
                </span>
              )}
            </span>
            <span
              className="text-emerald-400 tabular-nums font-medium"
              style={{ fontSize: 'clamp(8px, 0.6vw, 10px)' }}
            >
              {originalLength} → {optimizedLength} chars (−{charsSaved})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
