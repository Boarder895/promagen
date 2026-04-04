'use client';

// src/components/admin/builder-quality/post-processing-panel.tsx
// ============================================================================
// POST-PROCESSING PANEL — §9.6 Post-Processing Reliance
// ============================================================================
//
// Shows percentage of prompts modified by compliance gates after Call 3.
// Amber warning if > 50%. Collapsible before/after text blocks.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.6
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

import { useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface PostProcessingStats {
  totalScenes: number;
  changedCount: number;
  percentage: number;
}

interface DetailResult {
  sceneId: string;
  sceneName: string;
  rawOptimisedPrompt: string;
  optimisedPrompt: string;
  postProcessingChanged: boolean;
  postProcessingDelta: string | null;
}

interface Props {
  stats: PostProcessingStats;
  /** Only results where postProcessingChanged is true */
  changedResults: DetailResult[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PostProcessingPanel({ stats, changedResults }: Props) {
  const [expandedScene, setExpandedScene] = useState<string | null>(null);

  const isHigh = stats.percentage > 50;

  return (
    <div className="rounded-lg border border-white/10">
      {/* Summary bar */}
      <div
        className={`flex items-center justify-between ${
          isHigh ? 'bg-amber-500/10' : 'bg-white/5'
        }`}
        style={{ padding: 'clamp(10px, 1vw, 16px) clamp(12px, 1.2vw, 18px)' }}
      >
        <div className="flex items-center" style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}>
          <span
            className={`font-mono font-semibold ${isHigh ? 'text-amber-400' : 'text-emerald-400'}`}
            style={{ fontSize: 'clamp(16px, 1.8vw, 24px)' }}
          >
            {stats.percentage}%
          </span>
          <span
            className="text-slate-200"
            style={{ fontSize: 'clamp(11px, 1vw, 14px)' }}
          >
            of prompts modified after Call 3
          </span>
        </div>
        <span
          className="text-slate-300"
          style={{ fontSize: 'clamp(10px, 0.9vw, 12px)' }}
        >
          {stats.changedCount} / {stats.totalScenes} scenes
        </span>
      </div>

      {/* Warning */}
      {isHigh && (
        <div
          className="border-t border-amber-500/20 bg-amber-500/5 text-amber-300"
          style={{
            padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 18px)',
            fontSize: 'clamp(11px, 1vw, 13px)',
          }}
        >
          This platform relies heavily on compliance gates — {stats.percentage}% of prompts were
          modified after Call 3.
        </div>
      )}

      {/* Changed scenes list */}
      {changedResults.length > 0 && (
        <div className="border-t border-white/5">
          {changedResults.map((result) => {
            const isExpanded = expandedScene === result.sceneId;

            return (
              <div key={result.sceneId} className="border-b border-white/5 last:border-b-0">
                <button
                  onClick={() => setExpandedScene(isExpanded ? null : result.sceneId)}
                  className="flex w-full cursor-pointer items-center justify-between text-left transition-colors hover:bg-white/5"
                  style={{
                    padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1.2vw, 18px)',
                  }}
                >
                  <span
                    className="font-medium text-white"
                    style={{ fontSize: 'clamp(11px, 1vw, 13px)' }}
                  >
                    {result.sceneId}
                  </span>
                  <span
                    className="text-slate-300"
                    style={{
                      fontSize: 'clamp(10px, 0.8vw, 12px)',
                      transition: 'transform 0.15s',
                      display: 'inline-block',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                  >
                    ▶
                  </span>
                </button>

                {isExpanded && (
                  <div
                    className="grid grid-cols-2 bg-white/[0.02]"
                    style={{
                      gap: 'clamp(8px, 0.8vw, 12px)',
                      padding: 'clamp(10px, 1vw, 16px) clamp(12px, 1.2vw, 18px)',
                    }}
                  >
                    {/* Before (raw) */}
                    <div>
                      <span
                        className="mb-2 block font-medium text-amber-300"
                        style={{ fontSize: 'clamp(10px, 0.85vw, 12px)' }}
                      >
                        Before (raw Call 3 output)
                      </span>
                      <pre
                        className="overflow-x-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 text-slate-200"
                        style={{
                          fontSize: 'clamp(10px, 0.85vw, 12px)',
                          padding: 'clamp(8px, 0.8vw, 12px)',
                          maxHeight: 'clamp(120px, 15vh, 200px)',
                          overflowY: 'auto',
                        }}
                      >
                        {result.rawOptimisedPrompt}
                      </pre>
                    </div>

                    {/* After (post-processed) */}
                    <div>
                      <span
                        className="mb-2 block font-medium text-emerald-300"
                        style={{ fontSize: 'clamp(10px, 0.85vw, 12px)' }}
                      >
                        After (post-processed)
                      </span>
                      <pre
                        className="overflow-x-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 text-slate-200"
                        style={{
                          fontSize: 'clamp(10px, 0.85vw, 12px)',
                          padding: 'clamp(8px, 0.8vw, 12px)',
                          maxHeight: 'clamp(120px, 15vh, 200px)',
                          overflowY: 'auto',
                        }}
                      >
                        {result.optimisedPrompt}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
