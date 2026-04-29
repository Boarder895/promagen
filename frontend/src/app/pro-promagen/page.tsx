// src/app/pro-promagen/page.tsx
// ============================================================================
// PRO PROMAGEN — Permanent redirect to /platforms (v10.5.0)
// ============================================================================
// The Pro Promagen subscription is retired (commercial-strategy.md §2.3).
// Pro sold customisable FX pairs, exchange selection, indices and market-view
// customisation — features tied to a finance-data layer the new product no
// longer surfaces. The prompt builder (the other Pro feature) is dead too,
// and BUILDER_FREE_FOR_EVERYONE makes the only remaining Pro privilege
// (+1 stackable category) moot.
//
// Inbound links and bookmarks redirect to /platforms (the consumer hero).
// The underlying ProPromagenClient component (~4800 lines) and the rest
// of the Pro feature surface (HomepageGrid, EngineBay, MissionControl,
// lib/prompt-builder, weather-prompt-generator, ribbon, FX/exchange/indices
// catalogs) remain in the codebase as dormant code, pending Stage 6b–6h
// deletion.
// ============================================================================

import { redirect } from 'next/navigation';

export default function ProPromagenRedirect(): never {
  redirect('/platforms');
}
