// src/app/studio/playground/page.tsx
// ============================================================================
// PROMPT LAB REDIRECT — Routes /studio/playground to /
// ============================================================================
// The Prompt Lab moved from /studio/playground to / (homepage).
// This redirect catches existing bookmarks, search engine links, and
// any internal references that haven't been updated yet.
//
// v8.0.0: Prompt Lab promoted to homepage
// ============================================================================

import { redirect } from 'next/navigation';

export default function PlaygroundRedirect() {
  redirect('/');
}
