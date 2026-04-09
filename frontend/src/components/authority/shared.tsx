// src/components/authority/shared.tsx
// ============================================================================
// SHARED AUTHORITY PAGE COMPONENTS
// ============================================================================
// Reusable presentation components for authority pages.
// Used by /platforms (hub), /platforms/[platformId] (profiles),
// and /platforms/negative-prompts (guide).
//
// RULES:
//   - Zero opacity dimming, zero banned greys
//   - All sizing via clamp()
//   - Pure presentational — no data fetching, no state
// ============================================================================

import React from 'react';

// ─── FAQ Item ──────────────────────────────────────────────────────────────

export function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div style={{ marginBottom: 'clamp(16px, 2vw, 28px)' }}>
      <h3
        className="text-amber-400 font-semibold"
        style={{ fontSize: 'clamp(14px, 1.1vw, 18px)', marginBottom: 'clamp(4px, 0.5vw, 8px)' }}
      >
        {question}
      </h3>
      <p className="text-white leading-relaxed" style={{ fontSize: 'clamp(13px, 1vw, 16px)' }}>
        {answer}
      </p>
    </div>
  );
}

// ─── Fact Card ─────────────────────────────────────────────────────────────

interface FactCardProps {
  label: string;
  value: string;
  color: string;
  detail?: string;
}

export function FactCard({ label, value, color, detail }: FactCardProps) {
  return (
    <div
      className="rounded-xl"
      style={{
        padding: `clamp(12px, 1.3vw, 20px) clamp(14px, 1.5vw, 24px)`,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        className="text-white font-medium"
        style={{ fontSize: 'clamp(11px, 0.8vw, 13px)', marginBottom: 'clamp(2px, 0.3vw, 5px)' }}
      >
        {label}
      </div>
      <div className="font-semibold" style={{ fontSize: 'clamp(14px, 1.2vw, 20px)', color }}>
        {value}
      </div>
      {detail && (
        <div className="text-amber-300" style={{ fontSize: 'clamp(11px, 0.8vw, 13px)', marginTop: 'clamp(2px, 0.3vw, 4px)' }}>
          {detail}
        </div>
      )}
    </div>
  );
}

// ─── Section wrapper (reusable content section with heading) ────────────────

interface SectionProps {
  title: string;
  children: React.ReactNode;
  /** Optional id for anchor-link targets */
  id?: string;
}

export function Section({ title, children, id }: SectionProps) {
  return (
    <section
      id={id}
      style={{
        marginBottom: 'clamp(28px, 3vw, 48px)',
        maxWidth: 'clamp(400px, 55vw, 740px)',
      }}
    >
      <h2
        className="text-white font-semibold"
        style={{
          fontSize: 'clamp(18px, 1.5vw, 24px)',
          marginBottom: 'clamp(8px, 1vw, 14px)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
