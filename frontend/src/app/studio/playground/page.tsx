// src/app/studio/playground/page.tsx
// ============================================================================
// STUDIO PLAYGROUND — Permanent redirect to /platforms (v10.3.0)
// ============================================================================
// The Playground was the prompt builder's interactive surface. With the
// prompt builder retired (commercial-strategy.md §2.1), the route redirects
// to the 40-platform leaderboard.
//
// History:
//   v8.0.0  /studio/playground → /
//   v9.0.0  /studio/playground → /prompt-lab
//   v10.3.0 /studio/playground → /platforms (current; /prompt-lab also retired)
// ============================================================================

import { redirect } from 'next/navigation';

export default function PlaygroundRedirect(): never {
  redirect('/platforms');
}
