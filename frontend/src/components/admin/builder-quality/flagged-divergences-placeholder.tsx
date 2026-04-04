'use client';

// src/components/admin/builder-quality/flagged-divergences-placeholder.tsx
// ============================================================================
// FLAGGED DIVERGENCES PLACEHOLDER — §9.3 view (pre-Part 9)
// ============================================================================
//
// Placeholder for the Flagged Divergences view. This section activates in
// Part 9 when dual-model scoring (GPT vs Claude) is enabled. Until then,
// it shows an instruction text explaining the dependency.
//
// Once Part 9 lands, this file is replaced with a real table showing
// platforms where GPT vs Claude gap > 9pts, sorted by gap descending.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.3
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new file).
// ============================================================================

export function FlaggedDivergencesPlaceholder() {
  return (
    <div
      className="rounded-lg border border-white/10 bg-white/5 text-slate-300"
      style={{
        padding: 'clamp(20px, 2.5vw, 40px)',
        fontSize: 'clamp(12px, 1.1vw, 14px)',
        textAlign: 'center',
      }}
    >
      No divergence data available — dual-model scoring not enabled. This
      section activates in Part 9 when dual-model scoring is enabled.
    </div>
  );
}
