// src/components/prompt-lab/anchor-survival-panel.tsx
// ============================================================================
// ANCHOR SURVIVAL PANEL v1.0.0
// ============================================================================
// Pro-only collapsible panel that shows which visual anchors from the original
// scene survived into the optimised prompt. Green ✓ = survived, Red ✗ = lost.
//
// This is the visual output of Extra A (Anchor Survival Audit). GPT returns
// an anchorsPreserved array in the Call 3 JSON response. This component
// renders it as a green/red checklist — no competitor shows this.
//
// Styling: matches OptimizationTransparencyPanel exactly (same clamp sizes,
// border patterns, colour families). Uses cyan/teal for the panel chrome,
// emerald for preserved anchors, rose for lost anchors.
//
// Authority: trend-analysis.md §Extra A
// Existing features preserved: Yes (new file, no modifications).
// ============================================================================

'use client';

import React, { useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface AnchorItem {
  /** The visual anchor text (e.g., "gallery deck", "purple AND copper sky") */
  anchor: string;
  /** Whether this anchor survived into the optimised prompt */
  preserved: boolean;
}

export interface AnchorSurvivalPanelProps {
  /** Anchor survival data from Call 3 response */
  anchors: AnchorItem[];
  /** Whether user is on paid tier */
  isPro: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AnchorSurvivalPanel({ anchors, isPro }: AnchorSurvivalPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't render for free users or if no data
  if (!isPro || !anchors || anchors.length === 0) return null;

  const preserved = anchors.filter((a) => a.preserved);
  const lost = anchors.filter((a) => !a.preserved);
  const score = Math.round((preserved.length / anchors.length) * 100);

  // Colour coding based on score
  const scoreColor =
    score >= 90
      ? 'text-emerald-400'
      : score >= 70
        ? 'text-amber-400'
        : 'text-rose-400';

  const scoreBg =
    score >= 90
      ? 'bg-emerald-500/20'
      : score >= 70
        ? 'bg-amber-500/20'
        : 'bg-rose-500/20';

  return (
    <div
      className="rounded-lg border border-cyan-800/40 bg-cyan-950/20 overflow-hidden"
      style={{ marginTop: 'clamp(4px, 0.4vw, 6px)' }}
    >
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between transition-colors hover:bg-cyan-900/20 cursor-pointer"
        style={{
          padding: 'clamp(6px, 0.5vw, 10px) clamp(8px, 0.7vw, 12px)',
          gap: 'clamp(4px, 0.4vw, 6px)',
        }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}>
          <span
            className="text-cyan-400 transition-transform"
            style={{
              fontSize: 'clamp(8px, 0.6vw, 10px)',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            ▶
          </span>
          <span
            className="font-medium text-cyan-300"
            style={{ fontSize: 'clamp(0.6rem, 0.7vw, 0.75rem)' }}
          >
            Anchor Survival
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
          {/* Score pill — always visible */}
          <span
            className={`rounded-full font-medium tabular-nums ${scoreBg} ${scoreColor}`}
            style={{
              fontSize: 'clamp(8px, 0.6vw, 10px)',
              padding: 'clamp(1px, 0.1vw, 2px) clamp(6px, 0.5vw, 10px)',
            }}
          >
            {preserved.length}/{anchors.length} · {score}%
          </span>
          {/* Mini summary when collapsed */}
          {!isExpanded && lost.length > 0 && (
            <span
              className="text-rose-400 tabular-nums"
              style={{ fontSize: 'clamp(8px, 0.6vw, 10px)' }}
            >
              {lost.length} lost
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div
          className="border-t border-cyan-800/30"
          style={{ padding: 'clamp(8px, 0.6vw, 12px)' }}
        >
          {/* Description */}
          <p
            className="text-cyan-200"
            style={{
              fontSize: 'clamp(8px, 0.55vw, 10px)',
              marginBottom: 'clamp(6px, 0.4vw, 8px)',
              lineHeight: 1.4,
            }}
          >
            Visual anchors from your scene that the AI preserved or lost during optimisation.
            Lost anchors produce generic images.
          </p>

          {/* Preserved anchors */}
          {preserved.length > 0 && (
            <div
              className="flex flex-wrap"
              style={{
                gap: 'clamp(3px, 0.25vw, 5px)',
                marginBottom: lost.length > 0 ? 'clamp(6px, 0.4vw, 8px)' : '0',
              }}
            >
              {preserved.map((a, i) => (
                <span
                  key={`p-${i}`}
                  className="inline-flex items-center rounded-md border border-emerald-800/40 bg-emerald-950/30"
                  style={{
                    fontSize: 'clamp(8px, 0.55vw, 10px)',
                    padding: 'clamp(1px, 0.1vw, 2px) clamp(4px, 0.3vw, 6px)',
                    gap: 'clamp(2px, 0.2vw, 4px)',
                  }}
                >
                  <span className="text-emerald-400">✓</span>
                  <span className="text-emerald-300">{a.anchor}</span>
                </span>
              ))}
            </div>
          )}

          {/* Lost anchors */}
          {lost.length > 0 && (
            <div
              className="flex flex-wrap"
              style={{ gap: 'clamp(3px, 0.25vw, 5px)' }}
            >
              {lost.map((a, i) => (
                <span
                  key={`l-${i}`}
                  className="inline-flex items-center rounded-md border border-rose-800/40 bg-rose-950/30"
                  style={{
                    fontSize: 'clamp(8px, 0.55vw, 10px)',
                    padding: 'clamp(1px, 0.1vw, 2px) clamp(4px, 0.3vw, 6px)',
                    gap: 'clamp(2px, 0.2vw, 4px)',
                  }}
                >
                  <span className="text-rose-400">✗</span>
                  <span className="text-rose-300">{a.anchor}</span>
                </span>
              ))}
            </div>
          )}

          {/* Summary footer */}
          <div
            className="flex items-center justify-between border-t border-cyan-800/30"
            style={{
              marginTop: 'clamp(8px, 0.6vw, 12px)',
              paddingTop: 'clamp(6px, 0.4vw, 8px)',
            }}
          >
            <span className="text-cyan-300" style={{ fontSize: 'clamp(8px, 0.55vw, 10px)' }}>
              {preserved.length} preserved · {lost.length} lost
            </span>
            <span
              className={`font-medium tabular-nums ${scoreColor}`}
              style={{ fontSize: 'clamp(8px, 0.6vw, 10px)' }}
            >
              Fidelity: {score}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
