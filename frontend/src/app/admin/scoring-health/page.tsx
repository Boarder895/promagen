// src/app/admin/scoring-health/page.tsx
// ============================================================================
// SCORING HEALTH PAGE — Server Component Entry Point
// ============================================================================
//
// Server-rendered wrapper for the scoring health dashboard.
// All client-side logic lives in scoring-health-client.tsx.
//
// This page sits within the /admin layout (inherits header, nav, dark theme).
//
// Authority: docs/authority/phase-7_11-admin-command-centre-buildplan.md § 4
//
// Version: 1.0.0
// Created: 2026-03-01
//
// Existing features preserved: Yes (new page, no existing code changed).
// ============================================================================

import { ScoringHealthClient } from './scoring-health-client';

export const metadata = {
  title: 'Scoring Health · Admin · Promagen',
  description: 'Comprehensive health dashboard for the self-improving scoring system.',
};

export default function ScoringHealthPage() {
  return <ScoringHealthClient />;
}
