// src/app/admin/builder-quality/[platformId]/page.tsx
// ============================================================================
// PLATFORM DETAIL PAGE — Server Component Entry Point
// ============================================================================
//
// Dynamic route for individual platform drill-down.
// Receives platformId from URL and runId from query params.
//
// Authority: docs/authority/builder-quality-intelligence.md v2.5.0 §9.2
// Build plan: part-8-build-plan v1.2.0, Sub-Delivery 8b
//
// Version: 1.0.0
// Created: 4 April 2026
//
// Existing features preserved: Yes (new page, no existing code changed).
// ============================================================================

import { PlatformDetailClient } from './platform-detail-client';

export const metadata = {
  title: 'Platform Detail · Builder Quality · Admin · Promagen',
  description: 'Per-platform scene breakdown, anchor audit, and regression tracking.',
};

export default async function PlatformDetailPage({
  params,
}: {
  params: Promise<{ platformId: string }>;
}) {
  const { platformId } = await params;
  return <PlatformDetailClient platformId={platformId} />;
}
