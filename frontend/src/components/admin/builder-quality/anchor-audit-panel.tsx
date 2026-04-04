'use client';

// src/components/admin/builder-quality/anchor-audit-panel.tsx
// ============================================================================
// ANCHOR AUDIT PANEL — Per-scene anchor detail (inline expansion)
// ============================================================================
//
// Shows each expected anchor with status badge (exact/approximate/dropped),
// severity indicator (critical/important/optional), and GPT's note.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §3.2
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

// =============================================================================
// TYPES
// =============================================================================

export interface AnchorAuditEntry {
  anchor: string;
  severity: 'critical' | 'important' | 'optional';
  status: 'exact' | 'approximate' | 'dropped';
  note?: string;
}

interface Props {
  anchors: AnchorAuditEntry[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  exact: { label: 'Exact', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  approximate: { label: 'Approx', className: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  dropped: { label: 'Dropped', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-400',
  important: 'bg-amber-400',
  optional: 'bg-white',
};

const FALLBACK_STATUS = { label: 'Unknown', className: 'bg-white/10 text-slate-200 border-white/20' };

// =============================================================================
// COMPONENT
// =============================================================================

export function AnchorAuditPanel({ anchors }: Props) {
  if (anchors.length === 0) {
    return (
      <div
        className="text-slate-300"
        style={{
          padding: 'clamp(8px, 0.8vw, 12px) clamp(12px, 1vw, 16px)',
          fontSize: 'clamp(11px, 1vw, 13px)',
        }}
      >
        No anchor data available for this scene.
      </div>
    );
  }

  return (
    <div
      className="border-t border-white/5 bg-white/[0.02]"
      style={{ padding: 'clamp(10px, 1vw, 16px)' }}
    >
      <div className="flex flex-col" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
        {anchors.map((anchor, idx) => {
          const statusStyle = STATUS_STYLE[anchor.status] ?? FALLBACK_STATUS;
          const dotColour = SEVERITY_DOT[anchor.severity] ?? 'bg-white';

          return (
            <div
              key={`${anchor.anchor}-${idx}`}
              className="flex items-start"
              style={{ gap: 'clamp(8px, 0.8vw, 12px)' }}
            >
              {/* Severity dot */}
              <div
                className={`shrink-0 rounded-full ${dotColour}`}
                style={{
                  width: 'clamp(6px, 0.5vw, 8px)',
                  height: 'clamp(6px, 0.5vw, 8px)',
                  marginTop: 'clamp(4px, 0.4vw, 6px)',
                }}
                title={anchor.severity}
              />

              {/* Anchor text + note */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center" style={{ gap: 'clamp(6px, 0.6vw, 10px)' }}>
                  <span
                    className="font-mono text-white"
                    style={{ fontSize: 'clamp(10px, 0.9vw, 13px)' }}
                  >
                    {anchor.anchor}
                  </span>

                  {/* Status badge */}
                  <span
                    className={`inline-block shrink-0 rounded-full border font-medium ${statusStyle.className}`}
                    style={{
                      fontSize: 'clamp(10px, 0.75vw, 11px)',
                      padding: 'clamp(1px, 0.1vh, 2px) clamp(5px, 0.5vw, 8px)',
                    }}
                  >
                    {statusStyle.label}
                  </span>

                  {/* Severity label */}
                  <span
                    className="text-slate-300"
                    style={{ fontSize: 'clamp(10px, 0.8vw, 11px)' }}
                  >
                    {anchor.severity}
                  </span>
                </div>

                {/* GPT note */}
                {anchor.note && (
                  <p
                    className="text-slate-300"
                    style={{
                      fontSize: 'clamp(10px, 0.85vw, 12px)',
                      marginTop: 'clamp(2px, 0.2vw, 4px)',
                    }}
                  >
                    {anchor.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
