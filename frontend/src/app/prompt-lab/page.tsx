// src/app/prompt-lab/page.tsx
// ============================================================================
// PROMPT LAB — Permanent redirect to /platforms (v10.3.0)
// ============================================================================
// The prompt builder is dead per docs/authority/commercial-strategy.md §2.1.
// Major LLMs and image platforms now rewrite prompts internally; the moat
// for a third-party prompt builder collapsed.
//
// This route preserves inbound links and bookmarks by redirecting to the
// 40-platform leaderboard, which is the consumer hero from v10.x onward.
//
// The underlying PlaygroundPageClient component and the entire 3-call AI
// engine remain in the codebase as dormant code, pending a dedicated
// deletion PR (Pass 5 in commercial-strategy.md).
// ============================================================================

import { redirect } from 'next/navigation';

export default function PromptLabRedirect(): never {
  redirect('/platforms');
}
