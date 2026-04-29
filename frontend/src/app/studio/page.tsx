// src/app/studio/page.tsx
// ============================================================================
// STUDIO HUB — Permanent redirect to /platforms (v10.3.0)
// ============================================================================
// The Studio hub aggregated Prompt Lab + My Prompts + Playground — all
// surfaces tied to the prompt builder, which is dead. Inbound links and
// bookmarks now route to the 40-platform leaderboard.
//
// History:
//   v6.0.0   /studio → 301 redirect to /
//   v10.3.0  /studio → 301 redirect to /platforms (current)
// ============================================================================

import { redirect } from 'next/navigation';

export default function StudioRedirect(): never {
  redirect('/platforms');
}
