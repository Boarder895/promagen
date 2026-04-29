// src/app/studio/library/page.tsx
// ============================================================================
// STUDIO LIBRARY — Permanent redirect to /platforms (v10.3.0)
// ============================================================================
// The saved-prompts library was tied to the prompt builder's "save" action.
// With the prompt builder retired (commercial-strategy.md §2.1), saved
// prompts no longer have a creation surface. Inbound links redirect to the
// 40-platform leaderboard.
//
// User data (existing saved prompts in localStorage) is not deleted —
// only the public route is retired. Restoration would be a code change in a
// future PR if the product direction reverses.
// ============================================================================

import { redirect } from 'next/navigation';

export default function LibraryRedirect(): never {
  redirect('/platforms');
}
