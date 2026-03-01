'use client';

// src/components/admin/scoring-health/scoring-health-nav.tsx
// ============================================================================
// SCORING HEALTH NAV — Sticky sidebar with section jump links
// ============================================================================
//
// Renders a vertical nav with all dashboard sections. Uses
// IntersectionObserver to highlight the currently visible section.
// Clicking a link smooth-scrolls to that section.
//
// Sections not yet built show as disabled (greyed out, no click).
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 4
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new component, no existing code changed).
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { SCORING_HEALTH_SECTIONS } from '@/lib/admin/scoring-health-types';
import type { ScoringHealthSection } from '@/lib/admin/scoring-health-types';

// ============================================================================
// COMPONENT
// ============================================================================

export function ScoringHealthNav() {
  const [activeId, setActiveId] = useState<string>(SCORING_HEALTH_SECTIONS[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── IntersectionObserver for active section detection ──────────────
  useEffect(() => {
    // Only observe enabled sections that exist in the DOM
    const targets = SCORING_HEALTH_SECTIONS
      .filter((s) => s.enabled)
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    if (targets.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the entry with the highest intersection ratio
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
              bestEntry = entry;
            }
          }
        }
        if (bestEntry?.target.id) {
          setActiveId(bestEntry.target.id);
        }
      },
      {
        rootMargin: '-10% 0px -60% 0px', // Top 10-40% of viewport triggers
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    for (const target of targets) {
      observerRef.current.observe(target);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // ── Click handler — smooth scroll to section ──────────────────────
  function handleClick(section: ScoringHealthSection) {
    if (!section.enabled) return;

    const el = document.getElementById(section.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(section.id);
    }
  }

  return (
    <nav
      className="sticky top-20 flex flex-col"
      style={{
        gap: 'clamp(2px, 0.3vw, 4px)',
        width: 'clamp(140px, 14vw, 200px)',
        flexShrink: 0,
      }}
      aria-label="Scoring Health sections"
    >
      <span
        className="mb-1 font-semibold uppercase tracking-wider text-white/40"
        style={{ fontSize: 'clamp(9px, 0.8vw, 11px)' }}
      >
        Sections
      </span>

      {SCORING_HEALTH_SECTIONS.map((section) => {
        const isActive = activeId === section.id;
        const isDisabled = !section.enabled;

        return (
          <button
            key={section.id}
            onClick={() => handleClick(section)}
            disabled={isDisabled}
            className={`flex items-center rounded-md text-left transition-all ${
              isDisabled
                ? 'cursor-not-allowed text-white/15'
                : isActive
                  ? 'bg-white/10 text-white ring-1 ring-white/20'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/60'
            }`}
            style={{
              fontSize: 'clamp(10px, 0.9vw, 12px)',
              padding: 'clamp(4px, 0.4vw, 6px) clamp(8px, 0.8vw, 12px)',
              gap: 'clamp(4px, 0.4vw, 6px)',
            }}
            title={isDisabled ? `Section ${section.number}: Coming soon` : section.label}
          >
            <span
              className={`flex-shrink-0 font-mono ${isDisabled ? 'text-white/10' : isActive ? 'text-emerald-400/80' : 'text-white/25'}`}
              style={{ fontSize: 'clamp(8px, 0.7vw, 10px)', width: 'clamp(14px, 1.2vw, 18px)' }}
            >
              {section.number}
            </span>
            <span className="truncate">{section.label}</span>
            {isDisabled && (
              <span
                className="ml-auto flex-shrink-0 text-white/10"
                style={{ fontSize: 'clamp(7px, 0.6vw, 9px)' }}
              >
                soon
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
