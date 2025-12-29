// src/app/providers/[id]/prompt-builder/page.tsx
//
// DEPRECATED: This route has been merged into /providers/[id].
// This file exists only to redirect old links.
//
// Authority: docs/authority/prompt-builder-page.md

import { redirect } from 'next/navigation';

interface PageParams {
  params: {
    id: string;
  };
}

export default function PromptBuilderRedirect({ params }: PageParams) {
  // Permanent redirect to the new location
  redirect(`/providers/${encodeURIComponent(params.id)}`);
}
