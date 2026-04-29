// src/app/inspire/page.tsx
// ============================================================================
// INSPIRE — Permanent redirect to /platforms (v10.3.0)
// ============================================================================
// The Inspire experience (Scene Starters, Prompt of the Moment, weather
// prompts, Engine Bay, Mission Control, Community Pulse) was the consumer
// surface for the prompt builder. With the prompt builder retired and the
// 40-platform leaderboard taking over as the consumer hero
// (commercial-strategy.md §2.2), this route redirects to /platforms.
//
// History:
//   v9.0.0   /inspire → 301 redirect to /
//   v10.0.0  /inspire → standalone Inspire page (when leaderboard was the
//                       proof exhibit only)
//   v10.3.0  /inspire → permanent redirect to /platforms (current)
// ============================================================================

import { redirect } from 'next/navigation';

export default function InspireRedirect(): never {
  redirect('/platforms');
}
