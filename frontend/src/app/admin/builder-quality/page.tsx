// src/app/admin/builder-quality/page.tsx
// ============================================================================
// BUILDER QUALITY PAGE — Server Component Entry Point
// ============================================================================
//
// Server-rendered wrapper for the builder quality intelligence dashboard.
// All client-side logic lives in builder-quality-client.tsx.
//
// This page sits within the /admin layout (inherits header, nav, dark theme).
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8a
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new page, no existing code changed).
// ============================================================================

import { BuilderQualityClient } from './builder-quality-client';

export const metadata = {
  title: 'Builder Quality · Admin · Promagen',
  description: 'Builder quality intelligence dashboard — platform scores, anchor audits, run history.',
};

export default function BuilderQualityPage() {
  return <BuilderQualityClient />;
}
