// src/app/providers/compare/page.tsx
// ============================================================================
// PROVIDERS COMPARE REDIRECT (v10.4.0)
// ============================================================================
// Previously a placeholder stub ("Provider comparison content goes here").
// Comparison content lives at /platforms/compare/[slug] (8 pre-rendered
// pairs) and the platform hub at /platforms.
// ============================================================================

import { redirect } from 'next/navigation';

export default function ProvidersCompareRedirect(): never {
  redirect('/platforms');
}
