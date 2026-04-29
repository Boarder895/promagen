// src/app/providers/[id]/prompt-builder/page.tsx
// ============================================================================
// PROVIDER PROMPT-BUILDER REDIRECT (v10.4.0)
// ============================================================================
// Was redirecting to /providers/[id], which itself now redirects to
// /platforms/[id]. Skip the chain — go directly to the platform profile.
// ============================================================================

import { redirect } from 'next/navigation';

type Params = { id: string };

export default async function PromptBuilderRedirect({
  params,
}: {
  params: Promise<Params>;
}): Promise<never> {
  const { id } = await params;
  redirect(`/platforms/${encodeURIComponent(id)}`);
}
