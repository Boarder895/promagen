// src/app/providers/[id]/page.tsx
// ============================================================================
// PROVIDER PAGE — Permanent redirect to /platforms/[id] (v10.4.0)
// ============================================================================
// This route was the per-provider standard prompt builder. With the prompt
// builder retired (commercial-strategy.md §2.1), the route now redirects to
// the per-platform profile page at /platforms/[id], which is the consumer-
// hero surface for individual platforms.
//
// The previous ProviderPageClient and exchange-rail rendering are dormant
// pending Pass 5 deletion.
// ============================================================================

import { redirect } from 'next/navigation';

type Params = { id: string };

export default async function ProviderRedirect({
  params,
}: {
  params: Promise<Params>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/platforms/${encodeURIComponent(id)}`);
}
